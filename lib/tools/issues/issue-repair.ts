/**
 * Exposes managed-issue repair to authorized project agents.
 * This adapter validates untrusted tool input and delegates repair semantics to the application layer.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import {
  isIssueRepairFailure,
  ISSUE_REPAIR_SOURCE,
  repairManagedIssue,
  resolveProject,
} from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { getProject, readProjects } from "../../state/index.js";
import { requireWorkspaceDir } from "../context/index.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";
import { ISSUE_REPAIR_TOOL_NAME } from "./const.js";

/** Validates issue-repair arguments before context resolution or effects. */
const issueRepairInput = z.strictObject({
  channelId: requiredTextInput.trim().describe("Current bound chat/group ID; mutually exclusive with project.").optional(),
  project: requiredTextInput.trim().describe("Explicit project slug; mutually exclusive with channelId.").optional(),
  issueId: issueIdInput.describe("Positive provider issue ID."),
  source: z.enum(Object.values(ISSUE_REPAIR_SOURCE)).describe("Authoritative repair source."),
  dryRun: z.boolean().describe("Plan without mutation; defaults to true.").optional(),
  apply: z.boolean().describe("Apply a previously planned repair.").optional(),
  planToken: requiredTextInput.trim().describe("Token from the matching dry-run; required for apply.").optional(),
  reason: requiredTextInput.trim().describe("Optional operator reason included in audit events.").optional(),
});

/** Create the safe-by-default issue_repair plugin tool. */
export function createIssueRepairTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: ISSUE_REPAIR_TOOL_NAME,
    label: "Issue Repair",
    description: "Plan or apply a verified repair between local managed issue state and provider projection.",
    parameters: toolInputParameters(issueRepairInput),
    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = issueRepairInput.parse(rawParams);
      const projectInput = params.project;
      const channelId = params.channelId;

      if ((projectInput === undefined) === (channelId === undefined)) {
        throw new Error("Exactly one of project or channelId is required.");
      }

      const issueId = params.issueId;
      const source = params.source;
      const dryRun = params.dryRun;
      const apply = params.apply ?? false;

      if (dryRun === true && apply) throw new Error("dryRun and apply cannot both be true.");
      if (dryRun === false && !apply) throw new Error("dryRun: false requires apply: true.");
      const planToken = params.planToken;

      if (apply && !planToken) throw new Error("planToken from a matching dry-run is required for apply.");
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const project = projectInput
        ? getProject(await readProjects(workspaceDir), projectInput)
        : channelId
          ? (await resolveProject(workspaceDir, channelId)).project
          : undefined;

      if (!project) throw new Error("Project selection must resolve to exactly one configured project.");
      if (!toolCtx.agentId || toolCtx.agentId !== project.agentId) {
        throw new Error(`Project "${project.slug}" belongs to agent "${project.agentId}".`);
      }

      let result;

      try {
        result = await repairManagedIssue({
          workspaceDir,
          projectSlug: project.slug,
          issueId,
          source,
          apply,
          planToken,
          reason: params.reason,
          actor: toolCtx.agentId,
          channelContext: { channelId },
          runCommand: ctx.runCommand,
        });
      } catch (error) {
        if (!isIssueRepairFailure(error)) throw error;

        return jsonResult({
          success: false,
          mode: apply ? "apply" : "dry_run",
          status: "blocked",
          project: project.slug,
          issueId,
          source,
          error: { code: error.code, message: error.message, retryable: error.retryable },
        });
      }

      return jsonResult(result);
    },
  });
}
