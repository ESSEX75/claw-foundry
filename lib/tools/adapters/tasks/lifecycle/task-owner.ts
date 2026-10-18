/**
 * task_owner — Claim issue(s) for this instance.
 *
 * Commits ownership in local issue state and reconciles its provider label. Supports claiming a
 * single issue or all unclaimed queued issues for a project.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { claimManagedTasks, resolveProject, resolveProvider } from "../../../../application/index.js";
import type { PluginContext } from "../../../../context.js";
import { getOwnerLabel } from "../../../../domain/index.js";
import { loadInstanceName } from "../../../../instance.js";
import { loadConfig } from "../../../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../../../context/index.js";
import { channelIdInput, issueIdInput, toolInputParameters } from "../../../validation/index.js";
import { TASK_OWNER_TOOL_NAME } from "./const.js";

/** Validates task-owner arguments before context resolution or effects. */
const taskOwnerInput = z.strictObject({
  channelId: channelIdInput,
  issueId: issueIdInput.describe("Specific issue ID to claim. If omitted, claims all unclaimed queued issues.").optional(),
  force: z.boolean().describe("Override existing local owner (transfer ownership). Default: false.").optional(),
});

/** Create the task owner SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskOwnerTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: TASK_OWNER_TOOL_NAME,
    label: "Task Owner",
    description:
      "Claim issue(s) for this instance in local state and reconciling its owner label. " +
      "If issueId is given, claims that specific issue. Otherwise claims all unclaimed queued issues. " +
      "Use force to transfer ownership from another instance.",
    parameters: toolInputParameters(taskOwnerInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskOwnerInput.parse(rawParams);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const issueIdParam = params.issueId;
      const force = params.force ?? false;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      const { project } = await resolveProject(workspaceDir, channelId);
      const { provider, type: providerType } = await resolveProvider(workspaceDir, project, ctx.runCommand);
      const resolvedConfig = await loadConfig(workspaceDir, project.slug);
      const instanceName = await loadInstanceName(
        workspaceDir,
        resolvedConfig.instanceName,
      );
      const ownerLabel = getOwnerLabel(instanceName);

      const result = await claimManagedTasks({
        workspaceDir, project, issueId: issueIdParam, instanceName, force,
        provider, providerType, workflow: resolvedConfig.workflow,
        roles: Object.keys(resolvedConfig.roles),
      });

      return jsonResult({
        ...result,
        instanceName,
        ownerLabel,
        summary: `Claimed ${result.claimed.length} issue(s) for "${instanceName}"`
          + (result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : "")
          + (result.failed.length > 0 ? `, ${result.failed.length} failed` : ""),
      });
    },
  });
}
