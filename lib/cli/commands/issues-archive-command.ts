/** Registers archive status/purge and confirmed provider issue deletion commands. */

import type { Command } from "commander";

import { deleteManagedIssue, getIssueArchiveStatus, purgeIssueArchive, resolveProvider } from "../../application/index.js";
import { loadConfig } from "../../state/index.js";
import { resetIssueStores } from "../../state/index.js";
import { readProjects } from "../../state/index.js";
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
      const config = await loadConfig(workspaceDir, opts.project);

      console.log(JSON.stringify(await getIssueArchiveStatus({
        workspaceDir,
        projectSlug: opts.project,
        archiveRetention: config.issueArchiveMaintenance.archiveRetention,
        deletedProviderRetention: config.issueArchiveMaintenance.deletedProviderRetention,
        workflow: config.workflow,
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
      const config = await loadConfig(workspaceDir, opts.project);

      console.log(JSON.stringify(await purgeIssueArchive({
        workspaceDir,
        projectSlug: opts.project,
        archiveRetention: config.issueArchiveMaintenance.archiveRetention,
        deletedProviderRetention: config.issueArchiveMaintenance.deletedProviderRetention,
        maxItems: config.issueArchiveMaintenance.maxPerHeartbeat,
        apply: opts.apply === true,
        actor: "cli",
        correlationId: `archive-purge:${opts.project}:${Date.now()}`,
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
      const projects = await readProjects(workspaceDir);
      const project = projects.projects[opts.project];

      if (!project) throw new Error(`Project "${opts.project}" not found.`);
      const { provider } = await resolveProvider(workspaceDir, project, ctx.runCommand);

      console.log(JSON.stringify(await deleteManagedIssue({
        workspaceDir,
        projectSlug: project.slug,
        issueId,
        confirmIssueId,
        dryRun: opts.apply !== true,
        provider,
        actor: "cli",
      }), null, 2));
    });

  issues.command("reset-store")
    .description("Destructively replace active and archive stores with empty current-format files")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--confirm-project <slug>", "Must exactly match --project")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: { project: string; confirmProject: string; workspace?: string }) => {
      if (opts.confirmProject !== opts.project) throw new Error("--confirm-project must exactly match --project.");
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      await resetIssueStores(workspaceDir, opts.project);
      console.log(JSON.stringify({ projectSlug: opts.project, reset: true }, null, 2));
    });
}
