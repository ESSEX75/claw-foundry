/** Validates built-in role and level membership without restricting runtime configuration. */

import { DEFAULT_LEVELS, DEFAULT_ROLES } from "./const.js";
import type { LevelId, RoleId } from "./types.js";

/**
 * Check whether a value matches a built-in role identifier.
 *
 * @param value - Untrusted value to validate against built-in roles only.
 */
export function isBuiltInRoleId(value: unknown): value is RoleId {
  return typeof value === "string"
    && Object.values(DEFAULT_ROLES).some((role) => role === value);
}

/**
 * Check whether a value matches a built-in level identifier.
 *
 * @param value - Untrusted value to validate against built-in levels only.
 */
export function isBuiltInLevelId(value: unknown): value is LevelId {
  return typeof value === "string"
    && Object.values(DEFAULT_LEVELS).some((level) => level === value);
}
