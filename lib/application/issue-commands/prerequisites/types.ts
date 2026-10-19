/** Owns contracts for prerequisites. */

import type { RunCommand } from "../../../context.js";
import type { IssueProviderId, IssueRuntimeState, Project, WorkflowStateConfig } from "../../../domain/index.js";
import { STATE_TYPE } from "../../../domain/index.js";
import type { Issue, IssueProvider } from "../../../integrations/index.js";
import type { ResolvedConfig } from "../../../state/index.js";
import type { TASK_EVENT } from "../const.js";

/** Original route and runtime transport shared by the three route-based lifecycle commands. */
export type TaskLifecycleInput = {
  /** Owning workspace. */
  workspaceDir: string;
  /** Captured command destination. */
  channelId: string;
  /** Managed issue identity. */
  issueId: number;
  /** Provider command transport. */
  runCommand: RunCommand;
};

/** Exact immutable target captured before waiting for its issue lock. */
export type TaskLifecycleTarget = {
  /** Captured owning project; worker slots are refreshed under the issue lock. */
  project: Project;
  /** Complete persisted endpoint whose identity must remain unchanged. */
  endpoint: Project["channels"][number];
};

/** Commands that share readiness but retain distinct active-worker rules. */
export type TaskLifecycleOperation = typeof TASK_EVENT.START | typeof TASK_EVENT.SET_LEVEL | typeof TASK_EVENT.EDIT_BODY;

/** Fresh locked dependencies after routing, readiness and ownership validation. */
export type TaskLifecycleContext = {
  /** Same canonical project with fresh worker reservations. */
  project: Project;
  /** Provider scoped to that exact project. */
  provider: IssueProvider;
  /** Persisted provider identity. */
  providerType: IssueProviderId;
  /** Fresh resolved role and workflow configuration. */
  resolvedConfig: ResolvedConfig;
  /** Provider content for user edits and level selection only. */
  issue: Issue;
  /** Authoritative issue record, never inferred from labels. */
  runtimeState: IssueRuntimeState;
  /** Configuration matching the exact stored key and label. */
  currentState: WorkflowStateConfig;
};

/** Validated queue destination of a HOLD approval transition. */
export type QueueTarget = {
  /** Configured workflow key of the selected queue. */
  stateKey: string;
  /** Resolved queue configuration receiving the task. */
  state: Extract<WorkflowStateConfig, { type: typeof STATE_TYPE.QUEUE }>;
};
