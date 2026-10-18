/** Register explicitly confirmed provider deletion and local archival. */

import type { Command } from "commander";

import { deleteProjectIssue } from "../../../application/index.js";
import { CLI_ACTOR } from "../../const.js";
import { parseIssueId, requireExclusiveMode } from "../../parsing/index.js";
import { type AdministrativeCliContext, requireWorkspace } from "../../runtime/index.js";
import type { DeleteIssueOptions } from "./types.js";

/** Register explicitly confirmed provider deletion and local archival.
 * @param parent - Parent issues command group.
 * @param ctx - Runtime input and application transport capabilities.
 */
export function registerDeleteCommand(parent: Command, ctx: AdministrativeCliContext): void {
  parent.command("delete")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--issue <id>", "Issue ID")
    .option("--confirm-issue <id>", "Exact issue ID confirmation required with --apply")
    .option("--dry-run", "Preview deletion")
    .option("--apply", "Delete the provider issue and archive a tombstone")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: DeleteIssueOptions) => {
      requireExclusiveMode(opts.dryRun, opts.apply);
      const issueId = parseIssueId(opts.issue);
      const confirmIssueId = opts.confirmIssue === undefined ? undefined : parseIssueId(opts.confirmIssue);

      if (opts.apply && confirmIssueId !== issueId) throw new Error("--confirm-issue must exactly match --issue with --apply.");
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);
      const result = await deleteProjectIssue({
        workspaceDir,
        projectSlug: opts.project,
        issueId,
        confirmIssueId,
        dryRun: opts.apply !== true,
        runCommand: ctx.runCommand,
        actor: CLI_ACTOR,
      });

      console.log(JSON.stringify(result, null, 2));
      if (!result.dryRun && (!result.deleted || !result.archived)) process.exitCode = 1;
    });
}
