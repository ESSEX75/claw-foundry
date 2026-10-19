/** Stable identifiers for the ordered heartbeat maintenance passes. */
export const HEARTBEAT_PASS = {
  CREATION: "creation",
  PROJECTION: "projection",
  ARCHIVE: "archive",
  HEALTH: "health",
  REVIEW: "review",
  REVIEW_SKIP: "review_skip",
  TEST_SKIP: "test_skip",
} as const;

/** Whether a failed pass stops the project phase or allows independent passes to run. */
export const HEARTBEAT_PASS_FAILURE_POLICY = { STOP: "stop", CONTINUE: "continue" } as const;

/** Maximum creation recoveries per project maintenance pass. */
export const HEARTBEAT_CREATION_LIMIT = 20;

/** Audit operation emitted after one complete project sweep. */
export const HEARTBEAT_AUDIT_EVENT = {
  TICK: "heartbeat_tick",
} as const;

/** Machine-readable project-cycle refusals, independent of queue candidate reasons. */
export const HEARTBEAT_SKIP_REASON = {
  PASS_FAILED: "pass_failed",
  WORKFLOW_PASS_FAILED: "workflow_pass_failed",
  PROJECT_BLOCKED: "project_blocked",
  QUEUE_SKIPPED: "queue_skipped",
  TICK_FAILED: "tick_failed",
  WORKSPACE_REFRESH_FAILED: "workspace_refresh_failed",
  AGENT_TICK_FAILED: "agent_tick_failed",
} as const;
