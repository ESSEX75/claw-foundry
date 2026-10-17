/** Recovers terminal issues left active by interrupted completion and archive writes. */

import {
  ISSUE_ARCHIVE_REASON,
  STATE_TYPE,
  type WorkflowConfig,
} from "../../../domain/index.js";
import {
  readIssueArchiveStore,
  readIssueStateStore,
} from "../../../state/index.js";
import { archiveManagedIssue, archiveManagedIssueLocked } from "./command.js";
import { ARCHIVE_RECOVERY_ACTOR, ARCHIVE_RECOVERY_CORRELATION_PREFIX, ARCHIVE_RECOVERY_UNKNOWN_REASON } from "./const.js";
import { validateRetentionBudget } from "./planning.js";
import type { ArchiveRecoveryInput, ArchiveRecoveryResult } from "./types.js";

/** Recover terminal states left active by an interrupted terminal transition.
 * @param opts - Resolved project dependencies and the requested administrative operation.
 */
export async function recoverTerminalIssueArchives(opts: ArchiveRecoveryInput): Promise<ArchiveRecoveryResult> {
  validateRetentionBudget(opts.maxItems);
  const store = await readIssueStateStore(opts.workspaceDir, opts.projectSlug);
  const terminalKeys = new Set(Object.entries(opts.workflow.states)
    .filter(([, state]) => state.type === STATE_TYPE.TERMINAL)
    .map(([key]) => key));
  const archived: number[] = [];
  const skipped: ArchiveRecoveryResult["skipped"] = [];

  for (const state of Object.values(store.issues).filter(candidate => terminalKeys.has(candidate.workflowState)).slice(0, opts.maxItems)) {
    const result = await archiveManagedIssue({
      workspaceDir: opts.workspaceDir,
      projectSlug: opts.projectSlug,
      issueId: state.issueId,
      archiveReason: ISSUE_ARCHIVE_REASON.TERMINAL,
      workflow: opts.workflow,
      actor: opts.actor ?? ARCHIVE_RECOVERY_ACTOR,
      correlationId: `${ARCHIVE_RECOVERY_CORRELATION_PREFIX}${opts.projectSlug}:${state.issueId}`,
    });

    if (result.archived) archived.push(state.issueId);
    else skipped.push({ issueId: state.issueId, reason: result.reason ?? ARCHIVE_RECOVERY_UNKNOWN_REASON });
  }

  return { archived, skipped };
}

/** Resume an existing terminal archive before another pass alters its exact active source snapshot.
 * The caller owns the issue lock; a changed snapshot or blocked archive remains an error.
 * @param workspaceDir - Workspace containing both local stores.
 * @param projectSlug - Canonical project identity.
 * @param issueId - Locally terminal issue potentially duplicated by archive-first interruption.
 * @param workflow - Resolved workflow validating the local terminal pair.
 */
export async function recoverArchivedIssueLocked(workspaceDir: string, projectSlug: string, issueId: number, workflow: WorkflowConfig): Promise<boolean> {
  const archived = Object.values((await readIssueArchiveStore(workspaceDir, projectSlug)).issues)
    .find(record => record.issueId === issueId && record.archiveReason === ISSUE_ARCHIVE_REASON.TERMINAL);

  if (!archived) return false;
  const recovered = await archiveManagedIssueLocked({ workspaceDir, projectSlug, issueId, workflow,
    archiveReason: ISSUE_ARCHIVE_REASON.TERMINAL, actor: ARCHIVE_RECOVERY_ACTOR,
    correlationId: `${ARCHIVE_RECOVERY_CORRELATION_PREFIX}${projectSlug}:${issueId}` });

  if (!recovered.archived) throw new Error(`Interrupted terminal archive could not resume: ${recovered.reason}`);

  return true;
}
