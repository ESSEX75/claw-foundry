/** Contracts for heartbeat issue selection and locked workflow coordination. */

import type { IssueRuntimeState, Project, TransitionAction, WorkflowConfig, WorkflowPolicyRouting } from "../../../domain/index.js";
import type { Issue, IssueProvider, IssueReader } from "../../../integrations/index.js";

/** Selects managed issue candidates from local state and fetches their provider context. */
export type HeartbeatCandidateInput = {
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
export type HeartbeatCandidate = {
  /** Fresh provider issue used for context and provider actions. */
  issue: Issue;
  /** Authoritative local state that selected the candidate. */
  localState: IssueRuntimeState;
};

/** Exact local precondition and provider effects for one heartbeat transition. */
export type HeartbeatTransitionInput = {
  /** Ordered effects whose lifecycle is committed after successful execution. */
  actions?: readonly TransitionAction[];
  /** Workspace containing authoritative issue runtime state. */
  workspaceDir: string;
  /** Project identity and provider routing for the issue. */
  project: Pick<Project, "slug" | "channels" | "provider">;
  /** Managed provider issue identifier. */
  issueId: number;
  /** Provider used for issue reads and projection effects. */
  provider: IssueProvider;
  /** Resolved workflow containing the destination state. */
  workflow: WorkflowConfig;
  /** Local source label that must still match under the issue lock. */
  fromLabel: string;
  /** Destination state key committed to local runtime state. */
  workflowState: string;
  /** Destination label projected after the local commit. */
  workflowLabel: string;
  /** Optional close timestamp for a terminal transition. */
  closedAt?: string | null;
  /** Stable owner recorded by projection and archive effects. */
  owner: string;
  /** Policy-specific provider actions performed after the local recheck. */
  beforeCommit?: () => Promise<void>;
  /** Saved policy that must still match before effects. */
  routing?: WorkflowPolicyRouting;
};
