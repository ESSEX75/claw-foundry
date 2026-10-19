/** Pure retention eligibility and bounded policy validation. */

import { type ArchivedIssueRecord, ISSUE_ARCHIVE_REASON } from "../../../domain/index.js";
import { parseDuration } from "../../../duration/index.js";
import type { ArchiveExpiryInput } from "./types.js";

/** Reject negative, fractional, or unbounded mutation budgets.
 * @param maxItems - Maximum records inspected for retention effects.
 */
export function validateRetentionBudget(maxItems: number): void {
  if (!Number.isSafeInteger(maxItems) || maxItems < 0) throw new Error("maxItems must be a non-negative safe integer.");
}

/** Select the provider-deleted or ordinary archive retention window.
 * @param record - Immutable archived record selected for planning.
 * @param opts - Retention windows and fixed evaluation time.
 */
export function isArchiveRecordExpired(record: ArchivedIssueRecord, opts: ArchiveExpiryInput): boolean {
  const retention = record.archiveReason === ISSUE_ARCHIVE_REASON.PROVIDER_DELETED ? opts.deletedProviderRetention : opts.archiveRetention;

  return Date.parse(record.archivedAt) <= opts.now - parseDuration(retention);
}
