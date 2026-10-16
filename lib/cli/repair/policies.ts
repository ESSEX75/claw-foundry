/** Parses explicit policy migration selections without deriving runtime state from provider labels. */

import type { Command } from "commander";

import { migrateIssuePolicies } from "../../application/index.js";
import { isReviewPolicy, isTestPolicy, type ReviewPolicy, type TestPolicy } from "../../domain/index.js";
import { type AdministrativeCliContext, parseIssueSelection, parseSelection, requireExclusiveMode, requireWorkspace } from "../input/index.js";
import type { PolicyMigrationOptions } from "./types.js";

/** Parse the optional review policy through its domain value set.
 * @param value - Raw terminal policy or source value.
 */
function parseReviewPolicy(value: string | undefined): ReviewPolicy | undefined {
  if (value === undefined) return undefined;
  if (isReviewPolicy(value)) return value;
  throw new Error(`Invalid review policy "${value}". Use human, agent, or skip.`);
}

/** Parse the optional test policy through its domain value set.
 * @param value - Raw terminal policy or source value.
 */
function parseTestPolicy(value: string | undefined): TestPolicy | undefined {
  if (value === undefined) return undefined;
  if (isTestPolicy(value)) return value;
  throw new Error(`Invalid test policy "${value}". Use agent or skip.`);
}

/** Register policy snapshot migration over explicitly selected local issue state.
 * @param parent - Parent repair command group.
 * @param ctx - Runtime input and application transport capabilities.
 */
export function registerPolicyMigrationCommand(parent: Command, ctx: AdministrativeCliContext): void {
  parent
    .command("policies")
    .description("Migrate review/test policy snapshots for existing managed issues")
    .requiredOption("--project <slug>", "Project slug")
    .option("--review <policy>", "Set review policy: human, agent, or skip")
    .option("--test <policy>", "Set test policy: agent or skip")
    .option("--issue <ids>", "Comma-separated issue IDs to migrate")
    .option("--state <states>", "Comma-separated workflow state keys to filter")
    .option("--include-closed", "Include closed/done/rejected issues")
    .option("--dry-run", "Show planned changes without writing")
    .option("--apply", "Apply the migration. Required instead of --dry-run for write mode")
    .option("--workspace <path>", "Workspace path")
    .action(async (opts: PolicyMigrationOptions) => {
      requireExclusiveMode(opts.dryRun, opts.apply);
      const reviewPolicy = parseReviewPolicy(opts.review);
      const testPolicy = parseTestPolicy(opts.test);
      const issueIds = parseIssueSelection(opts.issue);
      const workflowStates = parseSelection(opts.state, "--state");
      const workspaceDir = requireWorkspace(opts.workspace, ctx.runtime);

      const result = await migrateIssuePolicies({
        workspaceDir,
        projectSlug: opts.project,
        reviewPolicy,
        testPolicy,
        issueIds,
        workflowStates,
        includeClosed: opts.includeClosed,
        dryRun: !opts.apply,
        runCommand: ctx.runCommand,
      });

      console.log(JSON.stringify(result, null, 2));
    });
}
