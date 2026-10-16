/** Exposes shared input parsing and read-only configuration operations to sibling CLI adapters. */

export { getDefaultWorkspaceDir, readCliConfig, requireWorkspace } from "./configuration.js";
export { parseIssueId, parseIssueSelection, parseSelection, requireExclusiveMode } from "./parsers.js";
export type { AdministrativeCliContext, CliConfigRuntime } from "./types.js";
