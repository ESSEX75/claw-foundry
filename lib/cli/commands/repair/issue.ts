/** Adapts exact issue repair selection, snapshot token and outcome to the terminal. */

import type { Command } from "commander";

import { ISSUE_REPAIR_SOURCE, type IssueRepairSource, repairManagedIssue } from "../../../application/index.js";
import { CLI_ACTOR } from "../../const.js";
import { parseIssueId, requireExclusiveMode } from "../../parsing/index.js";
import { type AdministrativeCliContext, requireWorkspace } from "../../runtime/index.js";
import type { IssueRepairOptions } from "./types.js";

/** Register explicit issue projection repair with the application-owned freshness gate.
 * @param parent - Parent repair command group.
 * @param ctx - Runtime input and application transport capabilities.
 */
export function registerIssueRepairCommand(parent: Command, ctx: AdministrativeCliContext): void {
  parent
    .command("issue")
    .description("Plan or apply one managed issue repair")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--issue <id>", "Issue ID")
    .requiredOption("--source <source>", "Repair source: local-state or provider")
    .option("--plan-token <token>", "Token returned by the matching dry-run")
    .option("--dry-run", "Show planned changes without writing")
    .option("--apply", "Apply the repair. Required instead of --dry-run for write mode")
    .option("--workspace <path>", "Workspace path")
    .option("--reason <text>", "Operator reason written to audit events")
    .action(async (opts: IssueRepairOptions) => {
      requireExclusiveMode(opts.dryRun, opts.apply);
      const issueId = parseIssueId(opts.issue);
      const source = parseRepairSource(opts.source);
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      if (opts.apply && !opts.planToken) throw new Error("--plan-token from a matching dry-run is required with --apply.");
      const result = await repairManagedIssue({
        workspaceDir,
        projectSlug: opts.project,
        issueId,
        source,
        apply: opts.apply === true,
        planToken: opts.planToken,
        reason: opts.reason,
        actor: CLI_ACTOR,
        runCommand: ctx.runCommand,
      });

      console.log(JSON.stringify(result, null, 2));
      if (!result.success) process.exitCode = 1;
    });
}

/** Validate the explicitly requested repair authority.
 * @param value - Raw terminal policy or source value.
 */
function parseRepairSource(value: string): IssueRepairSource {
  if (value === ISSUE_REPAIR_SOURCE.LOCAL_STATE || value === ISSUE_REPAIR_SOURCE.PROVIDER) return value;

  throw new Error(`Invalid repair source "${value}".`);
}
