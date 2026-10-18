/** Classifies persisted creation recovery eligibility without consuming the mutation budget. */

import type { IssueCreationOperation } from "../../../state/index.js";
import { ISSUE_CREATION_STATUS } from "../../../state/index.js";
import type { ValueOf } from "../../../types.js";
import { CREATION_RECOVERY_ELIGIBILITY } from "./const.js";

/** Select automatic recovery only for unfinished retryable operations outside backoff.
 * @param operation - Persisted operation, refreshed under its lock before mutation.
 * @param now - Current time in milliseconds supplied by the caller.
 */
export function creationRecoveryEligibility(operation: IssueCreationOperation, now: number): ValueOf<typeof CREATION_RECOVERY_ELIGIBILITY> {
  if (operation.status === ISSUE_CREATION_STATUS.READY) return CREATION_RECOVERY_ELIGIBILITY.READY;
  if (operation.status === ISSUE_CREATION_STATUS.MANUAL_REPAIR_REQUIRED
    || (operation.status === ISSUE_CREATION_STATUS.CREATION_FAILED && operation.lastError?.retryable === false)) return CREATION_RECOVERY_ELIGIBILITY.MANUAL;
  if (operation.retryAfter && Date.parse(operation.retryAfter) > now) return CREATION_RECOVERY_ELIGIBILITY.WAITING;

  return CREATION_RECOVERY_ELIGIBILITY.RUNNABLE;
}
