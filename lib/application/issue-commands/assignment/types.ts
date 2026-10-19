/** Owns contracts for assignment. */

import type { RunCommand } from "../../../context.js";
import type { IssueProviderId, Project, WorkflowConfig } from "../../../domain/index.js";
import type { IssueProvider } from "../../../integrations/index.js";

/** Ownership-transfer outcome; a refusal preserves the current owner. */
export type ClaimManagedTaskResult = ClaimAccepted | ClaimRefused;

/** Ownership was transferred successfully. */
type ClaimAccepted = {
  /** Successful transfer discriminator. */
  claimed: true;
};

/** A fresh-state eligibility check refused the transfer. */
type ClaimRefused = {
  /** Refused transfer discriminator. */
  claimed: false;
  /** Operator guidance explaining the refusal. */
  reason: string;
};

/** Explicit prepared-level change for a managed task. */
export type SetTaskLevelInput = {
  /** Configured workspace containing authoritative project state. */
  workspaceDir: string;
  /** Persisted notification destination used to resolve exactly one project. */
  channelId: string;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Requested or resolved level from the effective role configuration. */
  level: string;
  /** Operator explanation or reason the command could not proceed. */
  reason?: string;
  /** Runtime-owned command transport for provider operations. */
  runCommand: RunCommand;
};

/** Confirmed prepared assignment and operator-facing result. */
export type SetTaskLevelResult = {
  /** Confirms that the lifecycle command completed. */
  success: true;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Provider title used for task context and operator output. */
  issueTitle: string;
  /** Requested or resolved level from the effective role configuration. */
  level: string;
  /** Whether the command changed the current assignment or content. */
  changed: boolean;
  /** Previously prepared level, absent when no assignment existed. */
  fromLevel: string | null;
  /** Operator explanation retained verbatim for rendering. */
  reason?: string;
  /** Resolved project or its display name in command output. */
  project: string;
  /** Provider capability or identifier used for this operation. */
  provider: string;

};

/** Inputs consumed by claimManagedTask after adapter validation. */
export type ClaimManagedTaskInput = {
  /** Configured workspace containing authoritative project state. */
  workspaceDir: string;
  /** Resolved project or its display name in command output. */
  project: Project;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Instance identity to persist as the issue owner. */
  instanceName: string;
  /** Allows explicit transfer from another owner. */
  force: boolean;
  /** Provider capability or identifier used for this operation. */
  provider: IssueProvider;
  /** Canonical provider identifier persisted in runtime state. */
  providerType: IssueProviderId;
  /** Effective project workflow including custom states. */
  workflow: WorkflowConfig;
  /** Effective role identifiers or resolved role configurations. */
  roles: string[];
  /** Bulk-only guard: recheck current queue state and absence of worker ownership under lock. */
  queuedOnly?: boolean;
};

/** One task that was refused or failed, retaining the actionable cause. */
export type TaskClaimDiagnostic = {
  /** Provider-local issue identity. */
  issueId: number;
  /** Fresh refusal or underlying operation failure. */
  reason: string;
};

/** Single or bulk ownership command using already resolved runtime dependencies. */
export type ClaimManagedTasksInput = Omit<ClaimManagedTaskInput, "issueId" | "queuedOnly"> & {
  /** Omit to select locally queued records; provider-only issues are never candidates. */
  issueId?: number;
};

/** Ownership changes and independent refusal/failure outcomes. */
export type ClaimManagedTasksResult = {
  /** False if any attempted operation failed; eligibility refusals remain ordinary skips. */
  success: boolean;
  /** Issues whose ownership and label projection completed. */
  claimed: number[];
  /** Tasks refused by fresh local eligibility checks. */
  skipped: TaskClaimDiagnostic[];
  /** Failed operations, including projection failures after a local ownership commit. */
  failed: TaskClaimDiagnostic[];
};
