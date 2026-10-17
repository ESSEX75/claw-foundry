/** Exposes rank-based level selection and strict model lookup over resolved role configuration. */

export { resolveRoleLevel, validateRoleLevel } from "./assignment.js";
export { selectLevel } from "./level-selection.js";
export { resolveModelForLevel } from "./model-resolution.js";
export type { LevelSelection, ResolvedRoleDefinition } from "./types.js";
export type { EnabledRoleDefinition,ResolveRoleLevelInput } from "./types.js";
