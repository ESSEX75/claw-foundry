/** Exposes pure role identifiers and contracts; selection and defaults remain in lib/roles. */

export { DEFAULT_LEVELS, DEFAULT_ROLES } from "./const.js";
export { isBuiltInLevelId, isBuiltInRoleId } from "./guards.js";
export type { LevelId, RoleDefinition, RoleId, RoleLevelDefinition } from "./types.js";
