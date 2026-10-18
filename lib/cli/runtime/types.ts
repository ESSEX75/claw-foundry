/** Defines the minimal configuration and command capabilities required by terminal commands. */

import type { SetupRuntime } from "../../application/index.js";
import type { RunCommand } from "../../context.js";

/** Read-only SDK configuration access; failed reads remain operational errors. */
export type CliConfigRuntime = {
  /** Current SDK configuration reader, without configuration mutation access. */
  config: Pick<SetupRuntime["config"], "current">;
};

/** Dependencies used by administrative CLI commands without unrelated plugin services. */
export type AdministrativeCliContext = {
  /** Read-only SDK configuration used to resolve a default workspace. */
  runtime: CliConfigRuntime;
  /** Runtime-owned transport for application commands with provider effects. */
  runCommand: RunCommand;
};
