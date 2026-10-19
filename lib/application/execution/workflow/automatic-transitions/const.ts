/** Identifiers and command defaults owned by heartbeat review transitions. */

/** Audit event names emitted while heartbeat processes review transitions. */
export const REVIEW_AUDIT_EVENT = {
  GIT_FALLBACK: "review_git_fallback",
  TRANSITION: "review_transition",
  MERGE_FAILED: "review_merge_failed",
  SKIP_MERGE_FAILED: "review_skip_merge_failed",
  SKIP_TRANSITION: "review_skip_transition",
} as const;

/** Stable operation owners recorded by review transitions and projection work. */
export const REVIEW_TRANSITION_OWNER = {
  REVIEW: "heartbeat_review",
  REVIEW_SKIP: "heartbeat_review_skip",
  REVIEW_SKIP_MERGE_FAILURE: "heartbeat_review_skip_merge_failure",
} as const;

/** Reasons stored in review audit records and supplied to feedback callbacks. */
export const REVIEW_TRANSITION_REASON = {
  COMMIT_ON_BASE_BRANCH: "commit_on_base_branch",
  PR_COMMENTS: "pr_comments",
  CHANGES_REQUESTED: "changes_requested",
  MERGE_CONFLICT: "merge_conflict",
  PR_CLOSED: "pr_closed",
  MERGE_FAILED: "merge_failed",
} as const;

/** Default timeout when review callers do not supply a git-pull budget. */
export const DEFAULT_REVIEW_GIT_PULL_TIMEOUT_MS = 30_000;

/** Classified review observations consumed by heartbeat transition selection. */
export const REVIEW_OUTCOME = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  CONFLICT: "conflict",
  CLOSED_UNMERGED: "closed_unmerged",
  MISSING_PR: "missing_pr",
  PENDING: "pending",
  MERGE_FAILED: "merge_failed",
} as const;

/** Identifiers recorded by the heartbeat test-skip pass. */

/** Audit event emitted after a committed test-skip transition. */
export const TEST_SKIP_AUDIT_EVENT = "test_skip_transition";

/** Owner recorded by test-skip projection and archive work. */
export const TEST_SKIP_TRANSITION_OWNER = "heartbeat_test_skip";

/** Audit event for optional review delivery failure. */
export const REVIEW_NOTIFICATION_ERROR = "heartbeat_review_notification_error";
