/** Registers archive status/purge and confirmed provider issue deletion commands. */

import type { Command } from "commander";

import { deleteProjectIssue, inspectProjectIssueArchive, purgeProjectIssueArchive, resetProjectIssueStores } from "../../application/index.js";
import { type AdministrativeCliContext, parseIssueId, requireExclusiveMode, requireWorkspace } from "../input/index.js";

/** Register explicit issue archive, deletion, and store reset operations.
 * @param parent - Parent DevClaw command group.
 * @param ctx - Read-only configuration and application command transport.
 */
export function registerIssuesArchiveCommand(parent: Command, ctx: AdministrativeCliContext): void {
  const issues = parent.command("issues").description("Manage active and archived issue state");
  const archive = issues.command("archive").description("Inspect or purge the dedicated issue archive");

  archive.command("status")
    .requiredOption("--project <slug>", "Project slug")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: { project: string; workspace?: string }) => {
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
    .action(async (opts: { project: string; dryRun?: boolean; apply?: boolean; workspace?: string }) => {
      requireExclusiveMode(opts.dryRun, opts.apply);
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      console.log(JSON.stringify(await purgeProjectIssueArchive({
        workspaceDir,
        projectSlug: opts.project,
        apply: opts.apply === true,
        actor: "cli",
      }), null, 2));
    });

  issues.command("delete")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--issue <id>", "Issue ID")
    .option("--confirm-issue <id>", "Exact issue ID confirmation required with --apply")
    .option("--dry-run", "Preview deletion")
    .option("--apply", "Delete the provider issue and archive a tombstone")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: { project: string; issue: string; confirmIssue?: string; dryRun?: boolean; apply?: boolean; workspace?: string }) => {
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
        actor: "cli",
      });

      console.log(JSON.stringify(result, null, 2));
      if (!result.dryRun && (!result.deleted || !result.archived)) process.exitCode = 1;
    });

  issues.command("reset-store")
    .description("Destructively replace active and archive stores with empty current-format files")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--confirm-project <slug>", "Must exactly match --project")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: { project: string; confirmProject: string; workspace?: string }) => {
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      const result = await resetProjectIssueStores({ workspaceDir, projectSlug: opts.project, confirmProjectSlug: opts.confirmProject });

      console.log(JSON.stringify(result, null, 2));
    });
}
