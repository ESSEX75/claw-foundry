/** Shared read-only configuration, workspace resolution and runtime ports for CLI commands. */

export { getDefaultWorkspaceDir, readCliConfig, requireWorkspace } from "./configuration.js";
export type { AdministrativeCliContext, CliConfigRuntime } from "./types.js";
