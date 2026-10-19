/** Commits workflow transitions shared by agent completion and heartbeat review passes. */

import { getStateLabels, PIPELINE_NOTIFICATION_STATUS, resolveIssueClosedAt, sameWorkerRun, STATE_TYPE } from "../../../../domain/index.js";
import { findProjectIssueReservation, reservationMatchesWorkerRun } from "../../../../domain/index.js";
import { readIssueStateStore, readOptionalProjects, readWorkerDeliveryResolution } from "../../../../state/index.js";
import { transitionWorkflowLabel } from "../../../issues/projection/index.js";
import { reconcileManagedLabelsLocked } from "../../../issues/projection/index.js";
import { writeIssueRuntimeState } from "../../../issues/runtime/index.js";
import { NOTIFICATION_EVENT } from "../../../notifications/index.js";
import { releaseTransitionWorkerLocked } from "./recovery.js";
import { archiveTerminalIssueLocked } from "./terminal-archive.js";
import type { CommitTransitionInput } from "./types.js";

/** Apply provider label, persist local truth, reconcile projection, and optionally archive.
 * The caller owns the issue lock and performs policy-specific actions separately.
 * @param input - Resolved transition and current issue snapshot.
 */
export async function commitWorkflowTransitionLocked(input: CommitTransitionInput): Promise<boolean> {
  const { workspaceDir, project, issueId, provider, workflow, plan, owner, issue } = input;

  const state = (await readIssueStateStore(workspaceDir, project.slug)).issues[String(issueId)];

  if (!state) throw new Error(`Issue #${issueId} has no initialized local runtime state.`);

  if (input.checkLocalState) {

    if (state?.workflowLabel !== plan.from) return false;
    if (input.routing && state[input.routing.field] !== input.routing.value) return false;
  }

  if (workflow.states[state.workflowState]?.label !== state.workflowLabel) throw new Error(`Issue #${issueId} has workflow configuration drift.`);

  const deliveryResolution = await readWorkerDeliveryResolution(workspaceDir, project.slug, issueId);

  if (deliveryResolution && !deliveryResolution.completed) throw new Error(`Issue #${issueId} has a pending operator delivery resolution.`);

  if (state?.pendingWorkerRelease) throw new Error(`Issue #${issueId} has an unfinished worker release.`);
  const terminal = workflow.states[plan.toState]?.type === STATE_TYPE.TERMINAL;
  const eventKey = `${NOTIFICATION_EVENT.PIPELINE_COMPLETE}:${plan.toState}`;
  const previousNotification = state?.pipelineNotification;

  if (terminal && previousNotification && previousNotification.status !== PIPELINE_NOTIFICATION_STATUS.DELIVERED) {
    throw new Error(`Issue #${issueId} has an unresolved terminal notification.`);
  }

  const registry = await readOptionalProjects(workspaceDir);
  const slotWorker = findProjectIssueReservation(registry?.projects[project.slug], issueId);
  const worker = state.activeWorker;

  if ((slotWorker && (!worker || !reservationMatchesWorkerRun(slotWorker, issueId, worker))) || (worker && !slotWorker)
    || (slotWorker?.slot.delivery && worker?.delivery && slotWorker.slot.delivery.operationId !== worker.delivery.operationId)) {
    throw new Error(`Issue #${issueId} has inconsistent worker ownership.`);
  }

  if (input.completion && (!sameWorkerRun(worker, input.completion.worker) || state.workflowLabel !== plan.from)) {
    throw new Error(`Worker changed before transition commit of issue #${issueId}.`);
  }

  await input.beforeCommit?.();
  if (!issue.labels.includes(plan.toLabel)) await transitionWorkflowLabel(provider, workflow, issueId, plan.from, plan.toLabel);
  const labels = issue.labels.filter((label) => !getStateLabels(workflow).includes(label)).concat(plan.toLabel);

  await writeIssueRuntimeState({
    workspaceDir,
    project,
    issue: { ...issue, labels },
    providerType: project.provider,
    workflow,
    workflowState: plan.toState,
    workflowLabel: plan.toLabel,
    activeWorker: null,
    lastCompletion: input.completion,
    pendingWorkerRelease: worker,
    pipelineNotification: terminal ? { eventKey, status: PIPELINE_NOTIFICATION_STATUS.PENDING, attemptedAt: new Date().toISOString() } : undefined,
    closedAt: input.closedAt !== undefined ? input.closedAt : resolveIssueClosedAt(plan.actions, state.closedAt, new Date().toISOString()),
  });
  await releaseTransitionWorkerLocked(workspaceDir, project.slug, issueId);
  await reconcileManagedLabelsLocked({
    workspaceDir,
    projectSlug: project.slug,
    issueId,
    workflow,
    roles: input.roles,
    provider,
    owner,
  });

  if (input.archiveTerminal && workflow.states[plan.toState]?.type === STATE_TYPE.TERMINAL) {
    await archiveTerminalIssueLocked({
      workspaceDir,
      projectSlug: project.slug,
      issueId,
      workflow,
      issue,
      actor: owner,
      workflowState: plan.toState,
    });
  }

  return true;
}
