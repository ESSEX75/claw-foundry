/** Owns contracts for transitions. */

import type { IssueCompletionReceipt, Project, WorkflowConfig, WorkflowPolicyRouting } from "../../../domain/index.js";
import type { TransitionAction } from "../../../domain/index.js";
import type { Issue, IssueProvider } from "../../../integrations/index.js";
import type { TransitionPlan } from "../planning/index.js";

/** Arguments for a transition while its caller holds the issue lock. */
export type CommitTransitionInput = {
  /** Exact completion identity written with transition, release and notification intents. */
  completion?: IssueCompletionReceipt;
  /** Workspace containing the authoritative issue record. */
  workspaceDir: string;
  /** Project whose issue is transitioning. */
  project: Pick<Project, "slug" | "channels" | "provider">;
  /** Managed provider issue identifier. */
  issueId: number;
  /** Provider adapter used for visible effects. */
  provider: IssueProvider;
  /** Resolved workflow used for state and projection. */
  workflow: WorkflowConfig;
  /** Validated transition selected before effects. */
  plan: TransitionPlan;
  /** Owner recorded in projection and archive operations. */
  owner: string;
  /** Provider snapshot fetched before the transition. */
  issue: Issue;
  /** Optional close time for a successful close action. */
  closedAt?: string | null;
  /** Role identifiers required to project custom role labels. */
  roles?: string[];
  /** Reject a stale local state instead of repeating provider effects. */
  checkLocalState?: boolean;
  /** Routing policy that must still match before heartbeat actions run. */
  routing?: WorkflowPolicyRouting;
  /** Policy-specific provider actions performed only after the state check. */
  beforeCommit?: () => Promise<void>;
  /** Archive terminal state after its durable notification is handled. */
  archiveTerminal?: boolean;
};

/** Exact local precondition and provider effects for one heartbeat transition. */
export type AutomaticTransitionInput = {
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