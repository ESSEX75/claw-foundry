/** Exposes supported workspace setup and instruction-loading capabilities to the state package. */

export type { DefaultsScope } from "./configuration/index.js";
export {
  readWorkflowDocuments,
  resetDefaults,
  resetWorkspaceConfiguration,
  writeWorkspaceModels,
} from "./configuration/index.js";
export type { RoleInstructionsResult } from "./instructions/index.js";
export { loadRoleInstructions, readWorkspaceAgentInstructions, refreshSystemInstructionFiles } from "./instructions/index.js";
export { initializeWorkspaceFiles, scaffoldProjectOverrides, scaffoldWorkspace } from "./workspace/index.js";
