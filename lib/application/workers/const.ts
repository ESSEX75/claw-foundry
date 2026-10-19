/** Identifiers and policy values owned by worker coordination. */

/** Stable events written by worker commands and delivery recovery. */
export const WORKER_AUDIT_EVENT = {
  DISPATCH: "dispatch",
  SESSION_BUDGET_RESET: "session_budget_reset",
  WARNING: "dispatch_warning",
  MODEL_SELECTION: "model_selection",
  DELIVERY_RESOLVED: "dispatch_delivery_resolved",
  DELIVERY_UNKNOWN: "dispatch_delivery_unknown",
  DELIVERY_ATTENTION: "dispatch_delivery_needs_attention",
} as const;

/** Diagnostic step for retaining or confirming context submitted with one exact worker turn. */
export const REVIEW_SUMMARY_RECEIPT_STEP = "review_summary_receipt";
