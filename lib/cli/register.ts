/** Registers the plugin CLI namespace and delegates commands to their owning adapters. */

import type { Command } from "commander";

import { DEVCLAW_PLUGIN_ID } from "../const.js";
import { registerDoctorCommand } from "./doctor/index.js";
import { registerIssuesCommands } from "./issues/index.js";
import { registerRepairCommands } from "./repair/index.js";
import { registerSetupCommand } from "./setup/index.js";
import type { CliContext } from "./types.js";
import { registerWorkerDeliveryCommand } from "./worker-delivery/index.js";

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
