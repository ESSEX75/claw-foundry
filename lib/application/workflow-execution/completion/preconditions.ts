/** Checks authoritative worker identity and live PR evidence before completion effects. */

import { ISSUE_INTEGRITY_STATUS, type IssueCompletionReceipt, type IssueRuntimeState, type Project, sameWorkerRun, type WorkflowConfig } from "../../../domain/index.js";
import { findProjectIssueReservation, reservationMatchesWorkerRun } from "../../../domain/index.js";
import { type IssueProvider, PR_STATE } from "../../../integrations/index.js";
import type { CompletionInput } from "./types.js";

/** Require an open conflict-free exact PR, propagating lookup failures unchanged.
 * @param provider - Project-scoped provider observation capability.
 * @param issueId - Issue whose completing run produced the pull request.
 * @param prUrl - Captured exact request, if the caller already selected one.
 */
export async function requireCompletionPullRequest(provider: Pick<IssueProvider, "getPrStatus">, issueId: number, prUrl?: string): Promise<string> {
  const status = await provider.getPrStatus(issueId, prUrl);

  if (!status.url || (prUrl !== undefined && status.url !== prUrl) || status.state === PR_STATE.CLOSED || status.state === PR_STATE.MERGED) {
    throw new Error(`Cannot mark work_finish(done) without an open PR for issue #${issueId}. Create a PR referencing the issue without closing keywords, then retry.`);
  }

  if (status.mergeable === false) throw new Error(`Cannot complete work_finish(done) while PR still shows merge conflicts: ${status.url}.`);

  return status.url;
}

/** Validate the exact local run and slot, or identify a receipt for that run's committed retry.
 * @param state - Fresh authoritative runtime record.
 * @param project - Fresh project reservations read while holding the issue lock.
 * @param input - Captured worker and requested result.
 * @param workflow - Resolved workflow validating the authoritative source pair.
 * @param fromLabel - Source selected by the configured completion event.
 */
export function validateCompletionFrame(state: IssueRuntimeState, project: Project, input: CompletionInput,
  workflow: WorkflowConfig, fromLabel: string): IssueCompletionReceipt | undefined {
  const expected = input.expectedWorker;

  if (!expected || expected.role !== input.role) throw new Error("Completion requires the exact captured worker run.");
  const receipt = state.lastCompletion;
  const resuming = !state.activeWorker && receipt?.result === input.result && sameWorkerRun(receipt.worker, expected)
    && receipt.toState === state.workflowState && receipt.toLabel === state.workflowLabel;

  if (!resuming) {
    if (!sameWorkerRun(state.activeWorker, expected)
      || (expected.delivery && state.activeWorker?.delivery && expected.delivery.operationId !== state.activeWorker.delivery.operationId)) {
      throw new Error(`Worker changed before completion of issue #${state.issueId}.`);
    }

    if (state.integrityStatus !== ISSUE_INTEGRITY_STATUS.OK || state.providerMissing || state.pendingWorkerRelease) {
      throw new Error(`Issue #${state.issueId} is not ready for completion.`);
    }

    if (workflow.states[state.workflowState]?.label !== state.workflowLabel || state.workflowLabel !== fromLabel) {
      throw new Error(`Completion for #${state.issueId} expected ${fromLabel}, found ${state.workflowLabel}.`);
    }

    const selected = findProjectIssueReservation(project, state.issueId);
    const slot = project.workers[expected.role]?.levels[expected.level]?.[expected.slotIndex];

    if (!selected || !reservationMatchesWorkerRun(selected, state.issueId, expected) || !slot?.active
      || (slot.delivery && state.activeWorker?.delivery && slot.delivery.operationId !== state.activeWorker.delivery.operationId)) {
      throw new Error(`Worker changed before completion of issue #${state.issueId}.`);
    }
  } else {
    const reserved = findProjectIssueReservation(project, state.issueId);

    if (reserved && !reservationMatchesWorkerRun(reserved, state.issueId, expected)) throw new Error(`Issue #${state.issueId} has a replacement worker.`);
  }

  return resuming ? receipt : undefined;
}
