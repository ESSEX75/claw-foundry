/** Constants owned by ordered provider transition effects. */

/** Confirmed merge outcomes; an uncertain observation throws instead of becoming a workflow event. */
export const MERGE_EFFECT_OUTCOME = {
  MERGED: "merged",
  CONFLICT: "conflict",
  NO_PR: "no_pr",
} as const;

/** Optional checkout refresh command shared by all transition callers. */
export const TRANSITION_GIT_PULL_COMMAND = ["git", "pull"] as const;
