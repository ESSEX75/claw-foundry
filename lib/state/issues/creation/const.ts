/** Owns durable stage and failure identifiers for resumable issue-creation operations. */

/** Durable stages of a managed provider issue creation saga. */
export const ISSUE_CREATION_STATUS = {
  /** Local operation exists and provider creation has not been confirmed. */
  CREATING: "creating",
  /** Provider returned a stable issue identity. */
  PROVIDER_CREATED: "provider_created",
  /** Provider read-back matches the complete expected projection. */
  PROJECTION_VERIFIED: "projection_verified",
  /** Final local runtime state is committed and visible to lifecycle scans. */
  READY: "ready",
  /** A retryable or definitive pre-provider failure prevented readiness. */
  CREATION_FAILED: "creation_failed",
  /** Recovery cannot safely continue without an explicit operator decision. */
  MANUAL_REPAIR_REQUIRED: "manual_repair_required",
} as const;

/** Stable creation saga failure identifiers. */
export const ISSUE_CREATION_ERROR = {
  /** Concurrent issue creation request detected with conflicting parameters. */
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  /** Provider API returned a definitive error during issue creation. */
  PROVIDER_CREATE_FAILED: "PROVIDER_CREATE_FAILED",
  /** Provider response was ambiguous or request timed out during creation. */
  PROVIDER_CREATE_UNKNOWN: "PROVIDER_CREATE_UNKNOWN",
  /** Provider issue creation request was blocked due to API rate limits. */
  PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  /** Failed to apply initial projection labels/metadata to the created provider issue. */
  PROJECTION_APPLY_FAILED: "PROJECTION_APPLY_FAILED",
  /** Verification read-back of provider issue projection did not match expected runtime state. */
  PROJECTION_VERIFICATION_FAILED: "PROJECTION_VERIFICATION_FAILED",
  /** Provider issue created, but writing the initial local runtime state to disk failed. */
  LOCAL_COMMIT_FAILED: "LOCAL_COMMIT_FAILED",
  /** Creation saga failed in a non-recoverable state requiring manual operator intervention. */
  MANUAL_REPAIR_REQUIRED: "MANUAL_REPAIR_REQUIRED",
} as const;
