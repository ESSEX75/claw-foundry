/** Persists only projection-maintenance diagnostics while retaining independent blockers. */

import { ISSUE_INTEGRITY_STATUS, type IssueRuntimeState, UNVERIFIED_INTEGRITY_ERROR } from "../../../domain/index.js";
import { updateIssueStateStore } from "../../../state/index.js";
import { HEARTBEAT_PROJECTION_ERROR } from "./const.js";

/** Record confirmed absence while preserving independent failures.
 * @param workspaceDir - Workspace containing issue state.
 * @param projectSlug - Canonical owning project.
 * @param issueId - Provider issue identifier.
 * @param now - Time of the confirmed absence.
 */
export async function recordProviderMissing(
  workspaceDir: string,
  projectSlug: string,
  issueId: number,
  now: Date,
): Promise<NonNullable<IssueRuntimeState["providerMissing"]>> {
  return updateIssueStateStore(workspaceDir, projectSlug, (data) => {
    const issue = data.issues[String(issueId)];

    if (!issue) throw new Error(`Issue #${issueId} has no active state for provider-missing confirmation.`);
    const timestamp = now.toISOString();
    const missing = issue.providerMissing
      ? { ...issue.providerMissing, confirmations: issue.providerMissing.confirmations + 1, lastConfirmedAt: timestamp }
      : { confirmations: 1, firstConfirmedAt: timestamp, lastConfirmedAt: timestamp };

    const retainedErrors = issue.integrityErrors.filter(message => !message.startsWith(HEARTBEAT_PROJECTION_ERROR.MISSING_PREFIX));

    if (issue.integrityStatus !== ISSUE_INTEGRITY_STATUS.OK && issue.integrityErrors.length === 0) retainedErrors.push(UNVERIFIED_INTEGRITY_ERROR);
    const updated = {
      ...issue,
      providerMissing: missing,
      integrityStatus: retainedErrors.length > 0 || issue.integrityStatus === ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR
        ? ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR : ISSUE_INTEGRITY_STATUS.PROJECTION_DRIFT,
      integrityErrors: [...retainedErrors,
        `${HEARTBEAT_PROJECTION_ERROR.MISSING_PREFIX}${missing.confirmations}`],
      updatedAt: timestamp,
    };

    return { store: { ...data, issues: { ...data.issues, [String(issueId)]: updated } }, result: missing };
  });
}

/** Clear only provider-missing diagnostics after a successful lookup.
 * @param workspaceDir - Workspace containing issue state.
 * @param projectSlug - Canonical owning project.
 * @param issueId - Provider issue identifier.
 */
export async function clearProviderMissing(workspaceDir: string, projectSlug: string, issueId: number): Promise<void> {
  await updateIssueStateStore(workspaceDir, projectSlug, (data) => {
    const issue = data.issues[String(issueId)];

    if (!issue) return { store: data, result: undefined };
    const integrityErrors = issue.integrityErrors.filter(message => !message.startsWith(HEARTBEAT_PROJECTION_ERROR.MISSING_PREFIX));
    const clearIntegrity = integrityErrors.length === 0 && integrityErrors.length !== issue.integrityErrors.length;
    const updated = {
      ...issue,
      providerMissing: null,
      integrityStatus: clearIntegrity ? ISSUE_INTEGRITY_STATUS.OK : issue.integrityStatus,
      integrityErrors,
      updatedAt: new Date().toISOString(),
    };

    return { store: { ...data, issues: { ...data.issues, [String(issueId)]: updated } }, result: undefined };
  });
}

/** Add observed heartbeat errors without discarding independent blockers.
 * @param workspaceDir - Workspace containing issue state.
 * @param projectSlug - Canonical owning project.
 * @param issueId - Provider issue identifier.
 * @param errors - Observed errors retained until their own verification succeeds.
 */
export async function markIntegrityError(
  workspaceDir: string,
  projectSlug: string,
  issueId: number,
  errors: string[],
): Promise<void> {
  await setIntegrityStatus(workspaceDir, projectSlug, issueId, ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR, errors);
}

/** Merge failures or clear only verified heartbeat provider/metadata diagnostics.
 * @param workspaceDir - Workspace containing issue state.
 * @param projectSlug - Canonical owning project.
 * @param issueId - Provider issue identifier.
 * @param integrityStatus - Whether this observation verified heartbeat projection checks.
 * @param integrityErrors - New diagnostics; empty on successful verification.
 */
export async function setIntegrityStatus(
  workspaceDir: string,
  projectSlug: string,
  issueId: number,
  integrityStatus: IssueRuntimeState["integrityStatus"],
  integrityErrors: string[],
): Promise<void> {
  await updateIssueStateStore(workspaceDir, projectSlug, (data) => {
    const issue = data.issues[String(issueId)];

    if (!issue) return { store: data, result: undefined };
    const retained = integrityStatus === ISSUE_INTEGRITY_STATUS.OK
      ? issue.integrityErrors.filter(message => message !== HEARTBEAT_PROJECTION_ERROR.METADATA_MISSING
        && message !== HEARTBEAT_PROJECTION_ERROR.METADATA_MISMATCH && !message.startsWith(HEARTBEAT_PROJECTION_ERROR.FETCH_PREFIX))
      : [...issue.integrityErrors];

    if (integrityErrors.length > 0 && issue.integrityStatus !== ISSUE_INTEGRITY_STATUS.OK && issue.integrityErrors.length === 0) {
      retained.push(UNVERIFIED_INTEGRITY_ERROR);
    }

    const errors = [...new Set([...retained, ...integrityErrors])];
    const clearedOwnedErrors = retained.length !== issue.integrityErrors.length;
    const status = errors.length > 0 ? ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR
      : clearedOwnedErrors ? ISSUE_INTEGRITY_STATUS.OK : issue.integrityStatus;
    const updated = { ...issue, integrityStatus: status, integrityErrors: errors, updatedAt: new Date().toISOString() };

    return { store: { ...data, issues: { ...data.issues, [String(issueId)]: updated } }, result: undefined };
  });
}
