/**
 * Defines canonical built-in workflow identifiers and provider-visible metadata.
 */

import type { ValueOf } from "../../types.js";

/** Known internal workflow state keys used across the pipeline. */
export const WORKFLOW_STATE_KEYS = {
  /** Initial state where requirements are being formulated. */
  PLANNING: "planning",
  /** Task is queued and ready to be picked up by a developer. */
  TODO: "todo",
  /** Task is actively in progress by a developer. */
  DOING: "doing",
  /** Developer completed work; task is queued for code review. */
  TO_REVIEW: "toReview",
  /** Reviewer or agent is actively reviewing the pull request. */
  REVIEWING: "reviewing",
  /** Task passed review and is queued for testing. */
  TO_TEST: "toTest",
  /** QA agent is actively running tests and verifying the build. */
  TESTING: "testing",
  /** Task is fully completed and changes are merged. */
  DONE: "done",
  /** Task was rejected and closed without being completed. */
  REJECTED: "rejected",
  /** Task failed review or testing; queued for developer fixes and improvements. */
  TO_IMPROVE: "toImprove",
  /** Work is awaiting clarification before returning to the developer queue. */
  REFINING: "refining",
  /** Task is queued for architect/researcher design and research phase. */
  TO_RESEARCH: "toResearch",
  /** Architect/researcher is actively designing and researching the task. */
  RESEARCHING: "researching",
} as const;

/** Display labels for states on the provider issue trackers. */
export const WORKFLOW_STATE_LABELS = {
  PLANNING: "Planning",
  TODO: "To Do",
  DOING: "Doing",
  TO_REVIEW: "To Review",
  REVIEWING: "Reviewing",
  TO_TEST: "To Test",
  TESTING: "Testing",
  DONE: "Done",
  REJECTED: "Rejected",
  TO_IMPROVE: "To Improve",
  REFINING: "Refining",
  TO_RESEARCH: "To Research",
  RESEARCHING: "Researching",
} as const;

/** Corresponding colors for workflow state labels. */
export const WORKFLOW_STATE_COLORS = {
  PLANNING: "#95a5a6",
  TODO: "#428bca",
  DOING: "#f0ad4e",
  TO_REVIEW: "#7057ff",
  REVIEWING: "#c5def5",
  TO_TEST: "#5bc0de",
  TESTING: "#9b59b6",
  DONE: "#5cb85c",
  REJECTED: "#e11d48",
  TO_IMPROVE: "#d9534f",
  REFINING: "#f39c12",
  TO_RESEARCH: "#0075ca",
  RESEARCHING: "#4a90e2",
} as const;

/** Built-in execution modes for role and project parallelism. */
export const EXECUTION_MODE = {
  PARALLEL: "parallel",
  SEQUENTIAL: "sequential",
} as const;

/** Built-in transition actions with handler implementations. */
export const ACTION = {
  /** Pull latest git changes into repository. */
  GIT_PULL: "gitPull",
  /** Detect opened pull request for current issue. */
  DETECT_PR: "detectPr",
  /** Merge pull request into base branch. */
  MERGE_PR: "mergePr",
  /** Close provider issue. */
  CLOSE_ISSUE: "closeIssue",
  /** Reopen closed provider issue. */
  REOPEN_ISSUE: "reopenIssue",
} as const;

/** Built-in review check types for review states. */
export const REVIEW_CHECK = {
  /** Verify that pull request has been approved. */
  PR_APPROVED: "prApproved",
  /** Verify that pull request has been merged. */
  PR_MERGED: "prMerged",
} as const;

/** Built-in workflow transition trigger events. */
export const WORKFLOW_EVENT = {
  /** Event triggered when worker picks up a task. */
  PICKUP: "PICKUP",
  /** Event triggered when worker completes work. */
  COMPLETE: "COMPLETE",
  /** Event triggered when task is sent for review. */
  REVIEW: "REVIEW",
  /** Event triggered when PR is approved. */
  APPROVED: "APPROVED",
  /** Event triggered when PR merge fails. */
  MERGE_FAILED: "MERGE_FAILED",
  /** Event triggered when reviewer requests changes. */
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  /** Event triggered when PR has merge conflicts. */
  MERGE_CONFLICT: "MERGE_CONFLICT",
  /** Event triggered when testing passes. */
  PASS: "PASS",
  /** Event triggered when testing fails. */
  FAIL: "FAIL",
  /** Event triggered when step is skipped. */
  SKIP: "SKIP",
  /** Event triggered when task needs refinement. */
  REFINE: "REFINE",
  /** Event triggered when task is blocked. */
  BLOCKED: "BLOCKED",
  /** Event triggered on manual approval. */
  APPROVE: "APPROVE",
  /** Event triggered on manual rejection. */
  REJECT: "REJECT",
  /** Event triggered when PR is closed without merge. */
  PR_CLOSED: "PR_CLOSED",
} as const;

/** Built-in worker completion result identifiers. */
export const COMPLETION_RESULT = {
  /** Work completed successfully. */
  DONE: "done",
  /** Verification passed. */
  PASS: "pass",
  /** Verification failed. */
  FAIL: "fail",
  /** Work requires refinement. */
  REFINE: "refine",
  /** Work cannot continue. */
  BLOCKED: "blocked",
  /** Review approved the work. */
  APPROVE: "approve",
  /** Review rejected the work. */
  REJECT: "reject",
} as const;

/** Built-in workflow state behavior types. */
export const STATE_TYPE = {
  /** Queue state waiting for worker pickup. */
  QUEUE: "queue",
  /** Active state currently being processed by worker. */
  ACTIVE: "active",
  /** Hold state waiting on external action or approval. */
  HOLD: "hold",
  /** Terminal state concluding the workflow (e.g. done, rejected). */
  TERMINAL: "terminal",
} as const;

/** Incoming events identifying a configured feedback destination. */
export const FEEDBACK_EVENTS: ReadonlySet<ValueOf<typeof WORKFLOW_EVENT>> = new Set([
  WORKFLOW_EVENT.CHANGES_REQUESTED,
  WORKFLOW_EVENT.MERGE_CONFLICT,
  WORKFLOW_EVENT.MERGE_FAILED,
  WORKFLOW_EVENT.REJECT,
  WORKFLOW_EVENT.FAIL,
  WORKFLOW_EVENT.PR_CLOSED,
]);
