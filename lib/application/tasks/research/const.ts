/** Owns research command operation identity and caller-visible progress categories. */

/** Separates research creation requests from ordinary task creation keys. */
export const RESEARCH_CREATION_PREFIX = "research-task:";

/** Research progress distinguishes durable creation from gateway delivery evidence. */
export const RESEARCH_STATUS = {
  DRY_RUN: "dry_run",
  CREATION_PENDING: "creation_pending",
  QUEUED: "queued",
  DISPATCHED: "dispatched",
  EXISTING: "already_started",
  PROCESSED: "already_processed",
  DELIVERY_PENDING: "delivery_pending",
  BLOCKED: "blocked",
  DISPATCH_FAILED: "dispatch_failed",
} as const;
