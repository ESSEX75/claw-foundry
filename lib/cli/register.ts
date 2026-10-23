/** Registers the plugin CLI namespace and delegates commands to their owning adapters. */

import type { Command } from "commander";

import { CLAW_FOUNDRY_PLUGIN_ID } from "../shared/const.js";
import { registerDoctorCommand } from "./commands/doctor/index.js";
import { registerIssuesCommands } from "./commands/issues/index.js";
import { registerRepairCommands } from "./commands/repair/index.js";
import { registerSetupCommand } from "./commands/setup/index.js";
import { registerWorkerDeliveryCommand } from "./commands/worker-delivery/index.js";
import type { CliContext } from "./types.js";

/** Register the plugin command group and its supported operations.
 * @param program - SDK-owned command parser.
 * @param ctx - Shared runtime dependencies supplied to command adapters.
 */
export function registerCli(program: Command, ctx: CliContext): void {
  const clawFoundry = program
    .command(CLAW_FOUNDRY_PLUGIN_ID)
    .description("Claw Foundry development pipeline tools");

  registerRepairCommands(clawFoundry, ctx);
  registerIssuesCommands(clawFoundry, ctx);
  registerSetupCommand(clawFoundry, ctx);
  registerDoctorCommand(clawFoundry, ctx);
  registerWorkerDeliveryCommand(clawFoundry, ctx);
}
