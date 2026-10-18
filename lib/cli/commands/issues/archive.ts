/** Register local archive inspection and explicit bounded cleanup. */

import type { Command } from "commander";

import { inspectProjectIssueArchive, purgeProjectIssueArchive } from "../../../application/index.js";
import { CLI_ACTOR } from "../../const.js";
import { requireExclusiveMode } from "../../parsing/index.js";
import { type AdministrativeCliContext, requireWorkspace } from "../../runtime/index.js";
import type { ArchivePurgeOptions, IssueProjectOptions } from "./types.js";

/** Register local archive inspection and explicit bounded cleanup.
 * @param parent - Parent issues command group.
 * @param ctx - Runtime input and application transport capabilities.
 */
export function registerArchiveCommands(parent: Command, ctx: AdministrativeCliContext): void {
  const archive = parent.command("archive").description("Inspect or purge the dedicated issue archive");

  archive.command("status")
    .requiredOption("--project <slug>", "Project slug")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: IssueProjectOptions) => {
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      console.log(JSON.stringify(await inspectProjectIssueArchive({
        workspaceDir,
        projectSlug: opts.project,
      }), null, 2));
    });

  archive.command("purge")
    .requiredOption("--project <slug>", "Project slug")
    .option("--dry-run", "Show expired records without deleting them")
    .option("--apply", "Delete expired records")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: ArchivePurgeOptions) => {
      requireExclusiveMode(opts.dryRun, opts.apply);
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      console.log(JSON.stringify(await purgeProjectIssueArchive({
        workspaceDir,
        projectSlug: opts.project,
        apply: opts.apply === true,
        actor: CLI_ACTOR,
      }), null, 2));
    });
}
