/** Captures routing before locking and validates fresh lifecycle prerequisites against that exact target. */

import { isDeepStrictEqual } from "node:util";

import { findSlotByIssue, ISSUE_INTEGRITY_STATUS } from "../../../domain/index.js";
import { isIssueCreationReady, loadConfig, readIssueStateStore, readWorkerDeliveryResolution } from "../../../state/index.js";
import { resolveProject, resolveProvider } from "../../projects/index.js";
import { TASK_EVENT } from "../const.js";
import type { TaskLifecycleContext, TaskLifecycleInput, TaskLifecycleOperation, TaskLifecycleTarget } from "./types.js";

/** Validate the same project and route after the caller acquires its captured issue lock.
 * @param input - Original command route and issue identity.
 * @param target - Project and endpoint captured before waiting for the lock.
 * @param operation - Command-specific worker ownership policy and diagnostic attribution.
 */
export async function readTaskLifecycleContext(input: TaskLifecycleInput, target: TaskLifecycleTarget,
  operation: TaskLifecycleOperation): Promise<TaskLifecycleContext> {
  const current = await resolveProject(input.workspaceDir, input.channelId);
  const { project } = current;

  if (project.slug !== target.project.slug || project.repo !== target.project.repo || project.provider !== target.project.provider
    || project.agentId !== target.project.agentId || !isDeepStrictEqual(current.endpoint, target.endpoint)) {
    throw new Error("Project route changed while waiting for the issue lock; resolve the target again.");
  }

  const { workspaceDir, issueId } = input;
  const resolvedConfig = await loadConfig(workspaceDir, project.slug);
  const runtimeState = (await readIssueStateStore(workspaceDir, project.slug)).issues[String(issueId)];

  if (!runtimeState) throw new Error(`Issue #${issueId} has no local issue state. Backfill or repair local state before ${operation}.`);
  if (!await isIssueCreationReady(workspaceDir, project.slug, runtimeState.creationOperationId)) throw new Error(`Issue #${issueId} creation is not ready.`);
  if (runtimeState.integrityStatus === ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR) throw new Error(`Issue #${issueId} has integrity_error. Repair local state before ${operation}.`);
  if (runtimeState.providerMissing || runtimeState.provider !== project.provider) throw new Error(`Issue #${issueId} provider identity is unavailable or inconsistent.`);
  if (runtimeState.pendingWorkerRelease) throw new Error(`Issue #${issueId} has a pending worker release.`);
  const resolution = await readWorkerDeliveryResolution(workspaceDir, project.slug, issueId);

  if (resolution && !resolution.completed) throw new Error(`Issue #${issueId} has a pending worker delivery resolution.`);
  const currentState = resolvedConfig.workflow.states[runtimeState.workflowState];

  if (!currentState || currentState.label !== runtimeState.workflowLabel) {
    throw new Error(`Cannot execute ${operation} for #${issueId}: its local workflow state does not match the current configuration.`);
  }

  if (operation !== TASK_EVENT.EDIT_BODY) {
    if (runtimeState.activeWorker) throw new Error(`Issue #${issueId} already has an active worker.`);
    if (Object.values(project.workers).some(worker => findSlotByIssue(worker, issueId) !== null)) {
      throw new Error(`Issue #${issueId} is already assigned to a worker slot.`);
    }
  }

  const { provider, type: providerType } = await resolveProvider(workspaceDir, project, input.runCommand);
  const issue = await provider.getIssue(issueId);

  return { project, provider, providerType, resolvedConfig, issue, runtimeState, currentState };
}
