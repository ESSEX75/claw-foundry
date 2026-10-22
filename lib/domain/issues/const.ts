/**
 * issues/const.ts — Issue constants.
 */

/** Supported issue tracking provider constants. */
export const ISSUE_PROVIDER = {
  /** GitHub issue tracker provider. */
  GITHUB: "github",
  /** GitLab issue tracker provider. */
  GITLAB: "gitlab",
} as const;

/** Prefix used for instance ownership labels. */
export const OWNER_LABEL_PREFIX = "owner:";

/** Color used for instance ownership labels. */
export const OWNER_LABEL_COLOR = "#e4e4e4";

/** Status constants of local issue state integrity relative to the provider. */
export const ISSUE_INTEGRITY_STATUS = {
  /** Projection is synchronized and valid. */
  OK: "ok",
  /** Projection state has not been initialized yet. */
  PROJECTION_UNINITIALIZED: "projection_uninitialized",
  /** Drift detected between local runtime state and provider projection. */
  PROJECTION_DRIFT: "projection_drift",
  /** Severe state or data integrity error. */
  INTEGRITY_ERROR: "integrity_error",
} as const;

/** Persistence states for a terminal pipeline notification. */
export const PIPELINE_NOTIFICATION_STATUS = {
  /** Terminal intent committed before a delivery attempt is reserved. */
  PENDING: "pending",
  /** Delivery has been reserved but is not yet confirmed. */
  ATTEMPTING: "attempting",
  /** No transport ran; policy or routing must be corrected before delivery. */
  BLOCKED: "blocked",
  /** Transport was unavailable before submission; a later retry is safe. */
  RETRYABLE: "retryable",
  /** Acceptance is uncertain; inspect external evidence before retrying. */
  UNKNOWN: "unknown",
  /** The notification adapter confirmed delivery. */
  DELIVERED: "delivered",
} as const;

/** Reasons a managed issue leaves the active runtime store. */
export const ISSUE_ARCHIVE_REASON = {
  /** The workflow reached a final terminal state. */
  TERMINAL: "terminal",
  /** The provider confirmed that the issue was deleted. */
  PROVIDER_DELETED: "provider_deleted",
} as const;

/** Retention state of attachments associated with an archived issue. */
export const ATTACHMENT_DISPOSITION = {
  /** Files are retained in storage after issue archive. */
  RETAINED: "retained",
  /** Files have been explicitly purged from storage. */
  PURGED: "purged",
  /** No attachments were associated with the issue. */
  NONE: "none",
} as const;

/** Preserves an existing non-OK status whose diagnostic owner was not recorded. */
export const UNVERIFIED_INTEGRITY_ERROR = "Existing integrity failure requires independent verification.";
