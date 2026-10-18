/** Register the destructive recovery command for active and archive stores only. */

import type { Command } from "commander";

import { resetProjectIssueStores } from "../../../application/index.js";
import { type AdministrativeCliContext, requireWorkspace } from "../../runtime/index.js";
import type { ResetIssueStoreOptions } from "./types.js";

/** Register the destructive recovery command for active and archive stores only.
 * @param parent - Parent issues command group.
 * @param ctx - Runtime input and application transport capabilities.
 */
export function registerResetStoreCommand(parent: Command, ctx: AdministrativeCliContext): void {
  parent.command("reset-store")
    .description("Destructively replace active and archive stores with empty current-format files")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--confirm-project <slug>", "Must exactly match --project")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: ResetIssueStoreOptions) => {
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      const result = await resetProjectIssueStores({ workspaceDir, projectSlug: opts.project, confirmProjectSlug: opts.confirmProject });

      console.log(JSON.stringify(result, null, 2));
    });
}
