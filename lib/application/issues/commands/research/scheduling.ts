/** Schedules one ready research creation under the issue lock, preserving uncertain worker ownership. */

import type { ExecutionMode } from "../../../../domain/index.js";
import { findAvailableWorkerSlot, ISSUE_INTEGRITY_STATUS, WORKER_DELIVERY_STATUS, workerExecutionBlock } from "../../../../domain/index.js";
import type { Issue } from "../../../../integrations/index.js";
import { AGENT_TURN_STATUS } from "../../../../integrations/index.js";
import { getErrorMessage } from "../../../../shared/errors/index.js";
import { getRoleWorker, loadConfig, readIssueStateStore, readProjects, withIssueOrchestrationLock } from "../../../../state/index.js";
import { dispatchTaskLocked } from "../../../execution/workers/index.js";
import type { CreatedManagedTask } from "../creation/index.js";
import { RESEARCH_STATUS } from "./const.js";
import { planResearchWorkflow } from "./plan.js";
import type { ResearchTaskBase, ResearchTaskInput, ResearchTaskResult } from "./types.js";

/** Resume scheduling without repeating an already reserved or completed worker turn.
 * @param input - Original caller request and integration dependencies.
 * @param creation - Durable ready creation selected by its stable idempotency key.
 * @param issue - Confirmed provider identity from that operation.
 * @param base - Resolved display metadata for the creation plan.
 * @param projectExecution - Explicit cross-project scheduling mode.
 */
export async function scheduleResearch(input: ResearchTaskInput, creation: CreatedManagedTask, issue: Issue,
  base: ResearchTaskBase, projectExecution: ExecutionMode): Promise<ResearchTaskResult> {
  const result = { ...base, creation, issue };
  const config = await loadConfig(input.workspaceDir, creation.project);
  const plan = planResearchWorkflow(config.workflow, creation.workflowState);
  const level = base.level;
  const provider = input.provider;

  if (!provider) throw new Error("Research scheduling requires the resolved provider.");

  return withIssueOrchestrationLock(input.workspaceDir, creation.project, issue.iid, async (): Promise<ResearchTaskResult> => {
    const registry = await readProjects(input.workspaceDir);
    const fresh = registry.projects[creation.project];
    const local = (await readIssueStateStore(input.workspaceDir, creation.project)).issues[String(issue.iid)];

    if (!fresh || !local) return { ...result, success: false, status: RESEARCH_STATUS.BLOCKED,
      reason: "The ready creation has no active local issue/project record; inspect archival or repair." };
    const slots = Object.entries(fresh.workers).flatMap(([role, worker]) => Object.entries(worker.levels).flatMap(([slotLevel, workers]) =>
      (workers ?? []).flatMap((slot, slotIndex) => slot.active && slot.issueId === issue.iid ? [{ role, level: slotLevel, slotIndex, slot }] : [])));
    const reserved = slots[0];
    const delivery = reserved?.slot.delivery ?? local.activeWorker?.delivery;

    if (delivery) return { ...result, label: local.workflowLabel, success: true, status: RESEARCH_STATUS.DELIVERY_PENDING,
      deliveryId: delivery.operationId, deliveryStatus: delivery.status === WORKER_DELIVERY_STATUS.PENDING ? WORKER_DELIVERY_STATUS.PENDING : AGENT_TURN_STATUS.UNKNOWN };
    if (local.activeWorker && slots.length === 1 && reserved && local.activeWorker.role === reserved.role
      && local.activeWorker.level === reserved.level && local.activeWorker.slotIndex === reserved.slotIndex
      && local.activeWorker.sessionKey === reserved.slot.sessionKey && local.activeWorker.startedAt === reserved.slot.startTime) {
      return { ...result, label: local.workflowLabel, success: true, status: RESEARCH_STATUS.EXISTING,
        existingWorker: local.activeWorker, deliveryStatus: AGENT_TURN_STATUS.ACCEPTED };
    }

    if (slots.length || local.activeWorker || local.pendingWorkerRelease || local.integrityStatus !== ISSUE_INTEGRITY_STATUS.OK || local.providerMissing) {
      return { ...result, label: local.workflowLabel, success: false, status: RESEARCH_STATUS.BLOCKED, reason: "Local ownership or integrity requires reconciliation." };
    }

    if (local.workflowState !== plan.queueState) return { ...result, label: local.workflowLabel, success: true, status: RESEARCH_STATUS.PROCESSED };
    const currentConfig = await loadConfig(input.workspaceDir, creation.project);
    const currentPlan = planResearchWorkflow(currentConfig.workflow, plan.queueState);

    if (local.workflowLabel !== currentPlan.queueLabel || local.assignedRole !== plan.role || local.assignedLevel !== level) {
      return { ...result, success: false, status: RESEARCH_STATUS.BLOCKED, reason: "Local research assignment differs from the creation plan; inspect configuration or repair." };
    }

    const exclusion = workerExecutionBlock(registry.projects, creation.project, plan.role, currentConfig.workflow.roleExecution, projectExecution);
    const slotIndex = findAvailableWorkerSlot(getRoleWorker(fresh, plan.role), level, currentConfig.roles[plan.role]?.levels[level]?.maxWorkers ?? 0);

    if (exclusion || slotIndex === null) return { ...result, success: true, status: RESEARCH_STATUS.QUEUED, reason: exclusion ?? "Configured capacity is exhausted." };
    try {
      const observed = await provider.getIssue(issue.iid);
      const dispatch = await dispatchTaskLocked({ workspaceDir: input.workspaceDir, project: fresh, provider,
        issueId: issue.iid, issueTitle: observed.title, issueDescription: observed.description, issueUrl: observed.web_url, role: plan.role, level, slotIndex,
        fromLabel: currentPlan.queueLabel, toLabel: currentPlan.activeLabel, agentId: fresh.agentId,
        sessionKey: input.sessionKey, runtime: input.runtime, pluginConfig: input.pluginConfig, runCommand: input.runCommand });
      const committed = (await readIssueStateStore(input.workspaceDir, creation.project)).issues[String(issue.iid)];

      return { ...result, level: dispatch.level, model: dispatch.model, label: committed?.workflowLabel ?? local.workflowLabel,
        success: true, status: RESEARCH_STATUS.DISPATCHED,
        dispatch, deliveryId: dispatch.deliveryId, deliveryStatus: dispatch.deliveryStatus };
    } catch (error) {
      return { ...result, success: false, status: RESEARCH_STATUS.DISPATCH_FAILED, reason: getErrorMessage(error) };
    }
  });
}
