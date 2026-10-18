/** Defines the minimal runtime boundary supported by the complete CLI facade. */

import type { SetupOpts } from "../application/index.js";

/** Configuration and application command capabilities supplied by plugin composition. */
export type CliContext = Pick<SetupOpts, "runtime" | "runCommand">;
