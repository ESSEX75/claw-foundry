/** Resolves explicit, prepared and automatically selected assignments against a configured role scale. */

import { selectLevel } from "./level-selection.js";
import type { EnabledRoleDefinition,ResolveRoleLevelInput } from "./types.js";

/**
 * Resolve the worker level for a task while preserving explicit or prepared assignments.
 * Automatic selection uses the target role's resolved ranks for both built-in and custom roles.
 *
 * @param input - Runtime assignment, target role configuration, and issue text used for selection.
 */
export function resolveRoleLevel(input: ResolveRoleLevelInput): string {
  const { requestedLevel, runtimeState, targetRole, roleConfig } = input;

  if (!roleConfig.enabled) {
    throw new Error(`Role "${targetRole}" is disabled.`);
  }

  if (requestedLevel !== undefined) {
    validateRoleLevel(targetRole, requestedLevel, roleConfig);

    return requestedLevel;
  }

  if (
    runtimeState.assignedRole === targetRole
    && runtimeState.assignedLevel
    && Object.hasOwn(roleConfig.levels, runtimeState.assignedLevel)
  ) {
    return runtimeState.assignedLevel;
  }

  const selectedLevel = selectLevel(
    input.issueTitle,
    input.issueDescription,
    targetRole,
    roleConfig,
  ).level;

  validateRoleLevel(targetRole, selectedLevel, roleConfig);

  return selectedLevel;
}

/** Reject levels absent from the effective role configuration, including custom roles.
 * @param role - Configured role responsible for the workflow state or worker task.
 * @param level - Requested or resolved level from the effective role configuration.
 * @param roleConfig - Effective role settings including enabled levels.
 */
export function validateRoleLevel(
  role: string,
  level: string,
  roleConfig: EnabledRoleDefinition,
): void {
  if (!Object.hasOwn(roleConfig.levels, level)) {
    throw new Error(`Invalid level "${level}" for role "${role}". Valid: ${Object.keys(roleConfig.levels).join(", ")}`);
  }
}
