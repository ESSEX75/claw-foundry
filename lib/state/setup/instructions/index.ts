/** Exposes runtime instruction lookup and explicit system-document refresh. */

export { loadRoleInstructions } from "./roles.js";
export { readWorkspaceAgentInstructions, refreshSystemInstructionFiles } from "./system.js";
export type { RoleInstructionsResult } from "./types.js";
