/** Identifiers and policy values owned by worker completion. */

/** Local rejection identities consumed by diagnostics. */
export const WORKER_REJECTION_REASON = {
  MISSING_ACTIVE_WORKER: "missing_active_worker",
} as const;

/** Stable completion events retained across package relocation. */
export const COMPLETION_AUDIT_EVENT = {
  FINISHED: "work_finish",
  FINISH_REJECTED: "work_finish_rejected",
} as const;

/** Events written by completion coordination and provider actions. */
export const COMPLETION_EFFECT_AUDIT = {
  WARNING: "pipeline_warning",
  ACTION_FAILED: "pipeline_action_failed",
  TRANSITION: "pipeline_transition",
} as const;

/** Owners recorded by projection and archive operations. */
export const COMPLETION_OWNER = {
  COMPLETION: "pipeline_completion",
  MERGE_FAILURE: "pipeline_merge_failure",
} as const;
