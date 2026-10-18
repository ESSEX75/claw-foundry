/** Composes explicit issue repair and policy migration terminal adapters. */

import type { Command } from "commander";

import type { AdministrativeCliContext } from "../../runtime/index.js";
import { registerIssueRepairCommand } from "./issue.js";
import { registerPolicyMigrationCommand } from "./policies.js";

/** Register the repair namespace without exposing its individual handlers.
 * @param parent - Parent DevClaw command group.
 * @param ctx - Runtime input and application transport capabilities.
 */
export function registerRepairCommands(parent: Command, ctx: AdministrativeCliContext): void {
  const repair = parent.command("repair").description("Repair DevClaw-managed provider projections");

  registerIssueRepairCommand(repair, ctx);
  registerPolicyMigrationCommand(repair, ctx);
}
