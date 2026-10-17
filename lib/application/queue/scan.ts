/** Reads queue candidates from authoritative local state; provider failures remain visible. */

import type { IssueRuntimeState, WorkflowConfig } from "../../domain/index.js";
import { getQueueLabels } from "../../domain/index.js";
import type { IssueReader } from "../../integrations/index.js";
import { isIssueCreationReady, readIssueStateStore, readReadyIssueCreationIds, readWorkerDeliveryResolution } from "../../state/index.js";
import { selectLocalQueueCandidates } from "./select.js";
import type { QueueCandidate, QueueStateLocation } from "./types.js";

/** Select a bounded local snapshot in priority order; every mutation rechecks the exact issue.
 * @param role - Configured queue role.
 * @param workflow - Canonical state machine.
 * @param instanceName - Optional ownership restriction.
 * @param localState - Authoritative project store location.
 */
export async function listQueueCandidates(role: string, workflow: WorkflowConfig, instanceName: string | undefined,
  localState: QueueStateLocation): Promise<IssueRuntimeState[]> {
  const store = await readIssueStateStore(localState.workspaceDir, localState.projectSlug);

  return selectLocalQueueCandidates(Object.values(store.issues), getQueueLabels(workflow, role), workflow, instanceName, role);
}

/** Recheck exactly the issue whose lock the caller owns, without scanning another issue.
 * @param provider - Project issue reader.
 * @param role - Configured queue role.
 * @param workflow - Canonical configured state machine.
 * @param instanceName - Optional ownership restriction.
 * @param localState - Authoritative project store location.
 * @param issueId - Exact locked candidate.
 */
export async function readQueueCandidate(provider: Pick<IssueReader, "getIssue">, role: string, workflow: WorkflowConfig,
  instanceName: string | undefined, localState: QueueStateLocation, issueId: number): Promise<QueueCandidate | null> {
  const { workspaceDir, projectSlug } = localState;
  const state = (await readIssueStateStore(workspaceDir, projectSlug)).issues[String(issueId)];

  if (!state || selectLocalQueueCandidates([state], getQueueLabels(workflow, role), workflow, instanceName, role).length === 0) return null;
  if (!await isIssueCreationReady(workspaceDir, projectSlug, state.creationOperationId)) return null;
  const resolution = await readWorkerDeliveryResolution(workspaceDir, projectSlug, state.issueId);

  if (resolution && !resolution.completed) return null;

  return { issue: await provider.getIssue(state.issueId), label: state.workflowLabel, localState: state };
}

/** Find the first locally eligible candidate, retaining provider lookup failures.
 * @param provider - Project issue reader.
 * @param role - Configured queue role.
 * @param workflow - Resolved state machine.
 * @param instanceName - Optional ownership restriction.
 * @param localState - Authoritative project store location.
 */
export async function findNextIssueForRole(provider: Pick<IssueReader, "getIssue">, role: string, workflow: WorkflowConfig,
  instanceName: string | undefined, localState: QueueStateLocation): Promise<QueueCandidate | null> {
  const candidates = await listQueueCandidates(role, workflow, instanceName, localState);
  const ready = candidates.some(state => state.creationOperationId)
    ? await readReadyIssueCreationIds(localState.workspaceDir, localState.projectSlug) : new Set<string>();

  for (const state of candidates) {
    if (state.creationOperationId && !ready.has(state.creationOperationId)) continue;
    const candidate = await readQueueCandidate(provider, role, workflow, instanceName, localState, state.issueId);

    if (candidate) return candidate;
  }

  return null;
}
