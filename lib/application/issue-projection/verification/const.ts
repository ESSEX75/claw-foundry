/** Protocol and confirmation policy owned by projection maintenance. */

/** Actions reported by heartbeat projection integrity inspection. */
export const PROJECTION_INTEGRITY_ACTION = {
  LABEL_REPAIR: "label_repair",
  METADATA_ERROR: "metadata_error",
  PROVIDER_MISSING: "provider_missing",
  PROVIDER_FETCH_ERROR: "provider_fetch_error",
} as const;

/** Diagnostics owned by heartbeat provider/metadata verification; unrelated errors survive its passes. */
export const HEARTBEAT_PROJECTION_ERROR = {
  METADATA_MISSING: "issue metadata is missing",
  METADATA_MISMATCH: "issue metadata does not match local issue state",
  FETCH_PREFIX: "provider issue fetch failed: ",
  MISSING_PREFIX: "provider_missing_pending:",
} as const;

/** Audit events emitted while validating the provider projection. */
export const HEARTBEAT_PROJECTION_AUDIT_EVENT = {
  PROVIDER_DELETED_DETECTED: "issue_provider_deleted_detected",
  INTEGRITY_ERROR: "issue_projection_integrity_error",
  LABEL_REPAIR: "issue_projection_label_repair",
} as const;

/** Actor and projection owner recorded for heartbeat initiated changes. */
export const HEARTBEAT_PROJECTION_OWNER = {
  INSPECTION: "heartbeat_projection",
  REPAIR: "heartbeat_projection_repair",
} as const;

/** Stable audit reasons for provider absence and metadata verification failures. */
export const HEARTBEAT_PROJECTION_AUDIT_REASON = {
  ISSUE_NOT_FOUND: "confirmed_issue_not_found",
  PROVIDER_FETCH_ERROR: PROJECTION_INTEGRITY_ACTION.PROVIDER_FETCH_ERROR,
  METADATA_MISSING: "metadata_missing",
  METADATA_MISMATCH: "metadata_mismatch",
} as const;

/** Prefix shared by deletion detection and the corresponding archive operation. */
export const HEARTBEAT_PROVIDER_DELETED_CORRELATION_PREFIX = "provider-deleted:";

/** Confirmed provider absence must be observed repeatedly over a stable interval. */
export const HEARTBEAT_MISSING_CONFIRMATIONS = 3;

/** Minimum stable interval required before provider absence permits archival. */
export const HEARTBEAT_MISSING_DURATION_MS = 15 * 60_000;
