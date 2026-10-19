/** Contracts for heartbeat review selection, transitions, and optional notifications. */

import type { RunCommand } from "../../../context.js";
import type { Project, WorkflowConfig } from "../../../domain/index.js";
import type { IssueRuntimeState, WorkflowPolicyRouting } from "../../../domain/index.js";
import type { IssueProvider } from "../../../integrations/index.js";
import type { Issue, IssueReader } from "../../../integrations/index.js";
import type { ValueOf } from "../../../types.js";
import type { NotificationConfig, NotificationRuntime, NotifyEvent } from "../../notifications/index.js";
import type { TransitionEffectsResult } from "../effects/index.js";
import type { REVIEW_OUTCOME, REVIEW_TRANSITION_REASON } from "./const.js";

/** Retains locked effect observations for the caller's post-commit routing and notifications. */
export type ReviewEffectsCapture = {
  /** Result becomes available only after the ordered action executor returns. */
  result?: TransitionEffectsResult;
};

/** Project and provider context shared by the review heartbeat passes. */
type ReviewProjectInput = {
  /** Workspace containing authoritative issue runtime state. */
  workspaceDir: string;
  /** Project name recorded in review audit entries. */
  projectName: string;
  /** Project identity and provider routing used by transitions. */
  project: Pick<Project, "slug" | "channels" | "provider">;
  /** Resolved workflow that selects review queue states and transitions. */
  workflow: WorkflowConfig;
  /** Provider used for current observations and configured actions. */
  provider: IssueProvider;
};

/** Callback invoked after a committed PR merge. */
type ReviewMergeCallback = (
  issueId: number, prUrl: string | null, prTitle?: string, sourceBranch?: string,
) => void;

/** Feedback reason emitted after a committed review transition. */
type ReviewFeedbackReason =
  | typeof REVIEW_TRANSITION_REASON.CHANGES_REQUESTED
  | typeof REVIEW_TRANSITION_REASON.MERGE_CONFLICT;

/** Review pass inputs and callbacks invoked only after committed transitions. */
export type ReviewPassInput = ReviewProjectInput & {
  /** Checkout used for optional git refresh after merge. */
  repoPath: string;
  /** Optional git pull timeout; a local default applies when absent. */
  gitPullTimeoutMs?: number;
  /** Base branch for the direct-commit fallback check. */
  baseBranch?: string;
  /** Reports a committed PR merge for notification. */
  onMerge?: ReviewMergeCallback;
  /** Reports committed feedback or merge-conflict transitions. */
  onFeedback?: (
    issueId: number, reason: ReviewFeedbackReason, prUrl: string | null,
    issueTitle: string, issueUrl: string, nextState: string,
  ) => void;
  /** Reports a committed close-without-merge transition. */
  onPrClosed?: (issueId: number, prUrl: string | null, issueTitle: string, issueUrl: string, nextState: string) => void;
  /** Command capability used for optional git refresh. */
  runCommand: RunCommand;
};

/** Inputs for the saved review-skip policy pass. */
export type ReviewSkipPassInput = ReviewProjectInput & {
  /** Checkout used for optional git refresh after merge. */
  repoPath: string;
  /** Optional git pull timeout; a local default applies when absent. */
  gitPullTimeoutMs?: number;
  /** Reports a committed PR merge for notification. */
  onMerge?: ReviewMergeCallback;
  /** Command capability used for optional git refresh. */
  runCommand: RunCommand;
};

/** One optional review notification and its exact routing capabilities. */
export type ReviewNotificationInput = {
  /** Workspace containing the issue binding and audit trail. */
  workspaceDir: string;
  /** Owning project and its current endpoint registry. */
  project: Project;
  /** Provider-local issue whose persisted binding is resolved. */
  issueId: number;
  /** Complete event rendered for the recipient. */
  event: NotifyEvent;
  /** Notification policy from plugin configuration. */
  config: NotificationConfig;
  /** Native OpenClaw route and sender, when available. */
  runtime?: NotificationRuntime;
  /** Fallback command capability. */
  runCommand: RunCommand;
};

/** Provider observation without a merge failure diagnostic. */
type ReviewObservationOutcome = {
  /** Provider observation selecting a configured transition or no-op. */
  kind: Exclude<ValueOf<typeof REVIEW_OUTCOME>, typeof REVIEW_OUTCOME.MERGE_FAILED>;
};

/** Confirmed merge failure requiring the configured recovery transition. */
type ReviewMergeFailedOutcome = {
  /** Confirmed merge failure selects the configured recovery event. */
  kind: typeof REVIEW_OUTCOME.MERGE_FAILED;
  /** Provider failure diagnostic. */
  error: string;
};

/** Review provider outcome that selects a workflow transition or no-op. */
export type ReviewOutcome = ReviewObservationOutcome | ReviewMergeFailedOutcome;

/** Context for transitioning locally managed issues that skip the test queue. */
export type TestSkipPassInput = {
  /** Workspace containing authoritative issue runtime state. */
  workspaceDir: string;
  /** Project name recorded in test-skip audit entries. */
  projectName: string;
  /** Project identity and provider routing used by transitions. */
  project: Pick<Project, "slug" | "channels" | "provider">;
  /** Resolved workflow that selects test queue states and transitions. */
  workflow: WorkflowConfig;
  /** Provider used for current observations and configured actions. */
  provider: IssueProvider;
};

/** Selects managed issue candidates from local state and fetches their provider context. */
export type AutomaticTransitionCandidateInput = {
  /** Workspace containing the active issue store. */
  workspaceDir: string;
  /** Project whose initialized issues are selected. */
  projectSlug: string;
  /** Local workflow label required of each candidate. */
  workflowLabel: string;
  /** Provider capability used only to observe selected local issues. */
  provider: Pick<IssueReader, "getIssue">;
  /** Saved review or test policy required for this pass. */
  routing?: WorkflowPolicyRouting;
};

/** One locally selected issue paired with its provider observation. */
export type AutomaticTransitionCandidate = {
  /** Fresh provider issue used for context and provider actions. */
  issue: Issue;
  /** Authoritative local state that selected the candidate. */
  localState: IssueRuntimeState;
};