/** Registers the plugin CLI namespace and delegates commands to their owning adapters. */

import type { Command } from "commander";

import { DEVCLAW_PLUGIN_ID } from "../const.js";
import type { PluginContext } from "../context.js";
import { registerDoctorCommand } from "./commands/doctor-command.js";
import { registerIssuesArchiveCommand } from "./commands/issues-archive-command.js";
import { registerRepairIssueCommand } from "./commands/repair-issue-command.js";
import { registerSetupCommand } from "./commands/setup-command.js";
import { registerWorkerDeliveryCommand } from "./commands/worker-delivery-command.js";

/** Register the plugin command group and its supported operations.
 * @param program - SDK-owned command parser.
 * @param ctx - Shared runtime dependencies supplied to command adapters.
 */
export function registerCli(program: Command, ctx: PluginContext): void {
  const devclaw = program
    .command(DEVCLAW_PLUGIN_ID)
    .description("DevClaw development pipeline tools");

  registerRepairIssueCommand(devclaw, ctx);
  registerIssuesArchiveCommand(devclaw, ctx);
  registerSetupCommand(devclaw, ctx);
  registerDoctorCommand(devclaw, ctx);
  registerWorkerDeliveryCommand(devclaw, ctx);
}
