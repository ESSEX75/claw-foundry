/** Owns contracts for activation. */

import type { RunCommand } from "../../../context.js";
import type { IssueRuntimeState, WorkflowConfig, WorkflowStateConfig } from "../../../domain/index.js";
import type { ResolvedRoleConfig } from "../../../state/index.js";

/** Pure transition plan and resolved worker assignment. */
export type StartTaskDecision = {
  /** Authoritative workflow key before the transition. */
  fromStateKey: string;
  /** Current provider-visible workflow label. */
  fromLabel: string;
  /** Configured workflow key selected by the approval transition. */
  targetStateKey: string;
  /** Provider-visible label for the target queue. */
  targetLabel: string;
  /** Configured worker role responsible for the target queue. */
  targetRole: string;
  /** Resolved worker level, preserving valid explicit assignments. */
  assignedLevel: string;
};

/** Explicit approval request for a held managed task. */
export type StartTaskInput = {
  /** Configured workspace containing authoritative project state. */
  workspaceDir: string;
  /** Persisted notification destination used to resolve exactly one project. */
  channelId: string;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Requested or resolved level from the effective role configuration. */
  level?: string;
  /** Runtime-owned command transport for provider operations. */
  runCommand: RunCommand;
};

/** Confirmed lifecycle transition and resulting assignment. */
export type StartTaskResult = {
  /** Confirms that the lifecycle command completed. */
  success: true;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Provider title used for task context and operator output. */
  issueTitle: string;
  /** Workflow label before the transition. */
  from: string;
  /** Workflow label after the transition. */
  to: string;
  /** Whether a workflow transition was applied. */
  transitioned: boolean;
  /** Requested or resolved level from the effective role configuration. */
  level: string | null;
  /** Resolved project or its display name in command output. */
  project: string;

};

/** Inputs consumed by resolveStartTaskDecision after adapter validation. */
export type ResolveStartTaskDecisionInput = {
  /** Effective project workflow including custom states. */
  workflow: WorkflowConfig;
  /** Resolved configuration of the current authoritative state. */
  currentState: WorkflowStateConfig;
  /** Authoritative local issue record used to make the decision. */
  runtimeState: IssueRuntimeState;
  /** Effective role identifiers or resolved role configurations. */
  roles: Readonly<Record<string, ResolvedRoleConfig>>;
  /** Optional explicit level overriding automatic selection. */
  requestedLevel?: string;
  /** Provider title used for task context and operator output. */
  issueTitle: string;
  /** Provider description used for worker context or level selection. */
  issueDescription: string;
};
