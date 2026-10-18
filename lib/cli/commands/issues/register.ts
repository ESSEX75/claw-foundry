/** Composes issue archive, deletion and explicit store recovery terminal commands. */

import type { Command } from "commander";

import type { AdministrativeCliContext } from "../../runtime/index.js";
import { registerArchiveCommands } from "./archive.js";
import { registerDeleteCommand } from "./delete.js";
import { registerResetStoreCommand } from "./reset.js";

/** Register the issues namespace with independent application-backed operations.
 * @param parent - Parent DevClaw command group.
 * @param ctx - Runtime input and application transport capabilities.
 */
export function registerIssuesCommands(parent: Command, ctx: AdministrativeCliContext): void {
  const issues = parent.command("issues").description("Manage active and archived issue state");

  registerArchiveCommands(issues, ctx);
  registerDeleteCommand(issues, ctx);
  registerResetStoreCommand(issues, ctx);
}
