/** Resumes archive-first completion without mutating the immutable active source snapshot. */

import { type IssueCompletionReceipt, type IssueRuntimeState, resolveIssueClosedAt, STATE_TYPE } from "../../domain/index.js";
import { readIssueArchiveStore } from "../../state/index.js";
import { archiveManagedIssueLocked } from "../issues/index.js";
import { PIPELINE_OWNER, PIPELINE_TERMINAL_ARCHIVE_CORRELATION_PREFIX } from "./const.js";
import type { CompletionInput, CompletionOutput, CompletionPlan } from "./types.js";

/** Recover an existing terminal archive under the caller's issue lock before projection writes.
 * @param input - Original exact completion request.
 * @param state - Unchanged authoritative source of an interrupted archive-first transaction.
 * @param receipt - Matching committed completion selected by frame validation.
 * @param plan - Effective previously committed destination and display semantics.
 */
export async function resumeCompletionArchive(input: CompletionInput & Required<Pick<CompletionInput, "workflow">>, state: IssueRuntimeState,
  receipt: IssueCompletionReceipt, plan: CompletionPlan): Promise<CompletionOutput | undefined> {
  const { workspaceDir, projectSlug, issueId } = input;

  if (input.workflow.states[receipt.toState]?.type !== STATE_TYPE.TERMINAL) return undefined;
  const archived = Object.values((await readIssueArchiveStore(workspaceDir, projectSlug)).issues).find(record => record.issueId === issueId);

  if (!archived) return undefined;
  const recovered = await archiveManagedIssueLocked({ workspaceDir, projectSlug, issueId, workflow: input.workflow,
    archiveReason: archived.archiveReason, actor: PIPELINE_OWNER.COMPLETION,
    correlationId: `${PIPELINE_TERMINAL_ARCHIVE_CORRELATION_PREFIX}${projectSlug}:${issueId}:${receipt.toState}` });

  if (!recovered.archived) throw new Error(`Interrupted completion archive could not resume: ${recovered.reason}`);

  return { labelTransition: `${plan.rule.from} \u2192 ${receipt.toLabel}`,
    summary: input.summary, createdTasks: input.createdTasks,
    nextState: plan.nextState, prUrl: receipt.prUrl, issueUrl: archived.issueUrl, issueClosed: state.closedAt !== null,
    issueReopened: resolveIssueClosedAt(receipt.actions, state.closedAt, new Date().toISOString()) === null };
}
