/**
 * Exposes explicit bulk review/test policy migration to an agent.
 * The adapter validates JSON input and delegates state and projection changes to application code.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { migrateIssuePolicies } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { REVIEW_POLICY, TEST_POLICY } from "../../domain/index.js";
import { requireWorkspaceDir } from "../helpers.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates issue-policy-migrate arguments before context resolution or effects. */
const issuePolicyMigrateInput = z.strictObject({
  project: requiredTextInput.trim().describe("Project slug."),
  reviewPolicy: z.enum(REVIEW_POLICY).describe("Optional review policy.").optional(),
  testPolicy: z.enum(TEST_POLICY).describe("Optional test policy.").optional(),
  issueIds: z.array(issueIdInput).describe("Optional issue IDs.").optional(),
  workflowStates: z.array(requiredTextInput).describe("Optional state keys.").optional(),
  includeClosed: z.boolean().describe("Include terminal issue states.").optional(),
  dryRun: z.boolean().describe("Do not mutate local or provider state."),
});

/** Create the issue_policy_migrate administrative tool. */
export function createIssuePolicyMigrationTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "issue_policy_migrate",
    label: "Issue Policy Migration",
    description: "Migrate review/test policy snapshots for existing active managed issues.",
    parameters: toolInputParameters(issuePolicyMigrateInput),
    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = issuePolicyMigrateInput.parse(rawParams);
      const result = await migrateIssuePolicies({
        workspaceDir: requireWorkspaceDir(toolCtx),
        projectSlug: params.project,
        reviewPolicy: params.reviewPolicy,
        testPolicy: params.testPolicy,
        issueIds: params.issueIds,
        workflowStates: params.workflowStates,
        includeClosed: params.includeClosed,
        dryRun: params.dryRun,
        runCommand: ctx.runCommand,
      });

      return jsonResult({ success: true, ...result });
    },
  });
}
