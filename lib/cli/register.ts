/** Registers the plugin CLI namespace and delegates commands to their owning adapters. */

import type { Command } from "commander";

import { DEVCLAW_PLUGIN_ID } from "../shared/const.js";
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
  const devclaw = program
    .command(DEVCLAW_PLUGIN_ID)
    .description("DevClaw development pipeline tools");

  registerRepairCommands(devclaw, ctx);
  registerIssuesCommands(devclaw, ctx);
  registerSetupCommand(devclaw, ctx);
  registerDoctorCommand(devclaw, ctx);
  registerWorkerDeliveryCommand(devclaw, ctx);
}
