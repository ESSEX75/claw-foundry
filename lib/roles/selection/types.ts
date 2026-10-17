/** Owns the minimal resolved role contract and configured level selection result. */

import type { IssueRuntimeState, RoleLevelDefinition } from "../../domain/index.js";

/** Configured worker level selected for a task. */
export type LevelSelection = {
  /** Selected runtime level identifier. */
  level: string;
  /** Explanation of the selection signal. */
  reason: string;
};

/** Minimal resolved role shape accepted by role-selection behavior. */
export type ResolvedRoleDefinition = {
  /** Runtime levels keyed by configured identifier. */
  readonly levels: Readonly<Record<string, Readonly<RoleLevelDefinition>>>;
  /** Level selected when no complexity signal overrides it. */
  readonly defaultLevel: string;
};

/** Resolved role scale with application configuration enablement. */
export type EnabledRoleDefinition = ResolvedRoleDefinition & {
  /** Disabled roles cannot receive prepared or automatic assignments. */
  readonly enabled: boolean;
};

/** Inputs consumed by resolveRoleLevel after adapter validation. */
export type ResolveRoleLevelInput = {
  /** Optional explicit level overriding automatic selection. */
  requestedLevel?: string;
  /** Authoritative local issue record used to make the decision. */
  runtimeState: Pick<IssueRuntimeState, "assignedRole" | "assignedLevel">;
  /** Configured worker role responsible for the target queue. */
  targetRole: string;
  /** Effective role settings including enabled levels. */
  roleConfig: EnabledRoleDefinition;
  /** Provider title used for task context and operator output. */
  issueTitle: string;
  /** Provider description used for worker context or level selection. */
  issueDescription: string;
};
