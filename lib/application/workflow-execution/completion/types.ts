/** Contracts owned by worker completion. */

import type { RunCommand } from "../../../context.js";
import type { ActiveIssueWorker, Project, RoleWorkerState, WorkflowConfig } from "../../../domain/index.js";
import type { CreatedIssueReference } from "../../../domain/index.js";
import type { IssueRuntimeState, NotificationEndpoint, TransitionAction } from "../../../domain/index.js";
import type { Issue, IssueProvider } from "../../../integrations/index.js";
import type { ResolvedConfig } from "../../../state/index.js";
import type { NotificationRuntime } from "../../notifications/index.js";
import type { CompletionPlan } from "../planning/index.js";

/** Validated worker completion request from an adapter. */
export type FinishWorkInput = {
  /** Workspace containing the project registry. */
  workspaceDir: string;
  /** Unambiguous project destination supplied by the adapter. */
  channelId: string;
  /** Configured completing role. */
  role: string;
  /** Configured completion result. */
  result: string;
  /** Worker completion summary. */
  summary?: string;
  /** Optional observed PR URL. */
  prUrl?: string;
  /** Child tasks created by the worker. */
  createdTasks?: CreatedIssueReference[];
  /** Exact caller session when available. */
  sessionKey?: string;
  /** External command capability. */
  runCommand: RunCommand;
  /** Notification runtime capability. */
  runtime?: NotificationRuntime;
  /** Notification settings. */
  pluginConfig?: Record<string, unknown>;
};

/** Resolved finish context; the pipeline rechecks captured worker identity under its issue lock. */
export type FinishWorkContext = {
  /** Project selected without ambiguous routing. */
  project: Project;
  /** Fully resolved roles and workflow. */
  config: ResolvedConfig;
  /** Selected provider-local issue. */
  issueId: number;
  /** Exact slot run captured before PR preconditions. */
  worker: ActiveIssueWorker;
};

/** Successful finish response returned to tool adapters. */
export type FinishWorkResult = CompletionOutput & {
  /** Completion command finished successfully. */
  success: true;
  /** Human-readable project name. */
  project: string;
  /** Canonical project identity. */
  projectSlug: string;
  /** Completed issue. */
  issueId: number;
  /** Configured completing role. */
  role: string;
  /** Configured result. */
  result: string;
};

/** Rejection context retained without masking the original missing-worker error. */
export type MissingWorkerAuditInput = {
  /** Workspace receiving the audit record. */
  workspaceDir: string;
  /** Project display name. */
  projectName: string;
  /** Canonical project identity. */
  projectSlug: string;
  /** Requested role. */
  role: string;
  /** Requested result. */
  result: string;
  /** Requested caller session. */
  sessionKey?: string;
  /** Observed worker inventory. */
  roleWorker: RoleWorkerState;
  /** Resolved workflow interpreting local candidates. */
  workflow: WorkflowConfig;
};

/** User-facing result of a completed agent transition. */
export type CompletionOutput = {
  /** Provider-visible label change. */
  labelTransition: string;
  /** Original worker summary, retained for adapter rendering. */
  summary?: string;
  /** Child issue links reported by the completing worker. */
  createdTasks?: CreatedIssueReference[];
  /** Confirmed merge failure selecting the recovery destination. */
  mergeFailure?: string;
  /** Description or label of the destination state. */
  nextState: string;
  /** URL of the detected or supplied pull request. */
  prUrl?: string;
  /** URL of the completed issue. */
  issueUrl?: string;
  /** Final committed issue closure, including previously closed issues. */
  issueClosed?: boolean;
  /** Whether the processed lifecycle actions ended by reopening the issue. */
  issueReopened?: boolean;
};

/** Validated completion command and the capabilities needed to execute it. */
export type CompletionInput = {
  /** Exact worker observed by finish-work, rechecked before provider effects. */
  expectedWorker: ActiveIssueWorker;
  /** Workspace containing authoritative state. */
  workspaceDir: string;
  /** Canonical project identity. */
  projectSlug: string;
  /** Configured completing role. */
  role: string;
  /** Configured completion result. */
  result: string;
  /** Managed provider issue identifier. */
  issueId: number;
  /** Worker-provided completion summary. */
  summary?: string;
  /** Previously observed pull request URL. */
  prUrl?: string;
  /** Provider for workflow effects. */
  provider: IssueProvider;
  /** Resolved checkout for git actions. */
  repoPath: string;
  /** Display name used in announcements. */
  projectName: string;
  /** Configured project notification endpoints. */
  channels: NotificationEndpoint[];
  /** Plugin notification policy. */
  pluginConfig?: Record<string, unknown>;
  /** Plugin runtime for direct API access (avoids CLI subprocess timeouts) */
  runtime?: NotificationRuntime;
  /** Optional captured workflow; changes to this completion transition in fresh configuration are rejected. */
  workflow?: WorkflowConfig;
  /** Tasks created during this work session (e.g. architect implementation tasks) */
  createdTasks?: CreatedIssueReference[];
  /** Level of the completing worker */
  level?: string;
  /** Slot index within the level's array */
  slotIndex?: number;
  /** Command execution capability. */
  runCommand: RunCommand;
};

/** Observations from completion provider actions, retained for rendering. */
export type CompletionActions = {
  /** Processed prefix retained when merge conflicts after an earlier lifecycle action. */
  processedActions?: readonly TransitionAction[];
  /** Resolved pull request URL. */
  prUrl?: string;
  /** Whether the provider confirmed a merged PR. */
  mergedPr: boolean;
  /** Provider PR title. */
  prTitle?: string;
  /** Branch associated with the PR. */
  sourceBranch?: string;
  /** Confirmed merge failure requiring the configured recovery transition. */
  mergeFailure: CompletionMergeFailure | null;
};

/** Committed completion context passed to notification orchestration. */
export type CompletionNotificationInput = {
  /** Original command and delivery capabilities. */
  opts: CompletionInput;
  /** Owning project and exact routes. */
  project: Project;
  /** Issue context observed before effects. */
  issue: Issue;
  /** Committed authoritative runtime state. */
  runtimeState: IssueRuntimeState;
  /** Selected completion semantics. */
  plan: CompletionPlan;
  /** Provider observations used in event payloads. */
  actions: CompletionActions;
  /** Optional display name of the completing worker. */
  workerName?: string;
  /** Auxiliary events are emitted only on the initial completion attempt. */
  notifyAuxiliary: boolean;
};

/** Confirmed inability to merge, distinct from an uncertain provider response. */
type CompletionMergeFailure = {
  /** Provider failure diagnostic. */
  error: string;
};
