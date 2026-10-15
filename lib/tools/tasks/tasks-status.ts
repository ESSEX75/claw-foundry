/**
 * tasks_status — Live issue counts and details from the issue tracker.
 *
 * Fetches all non-terminal issues grouped by state type (hold, active, queue).
 * Use `project_status` for instant local info, this tool for live issue data.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { getManagedTaskStatus, resolveProject, resolveProvider } from "../../application/index.js";
import { log as auditLog } from "../../audit.js";
import type { PluginContext } from "../../context.js";
import { loadConfig } from "../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../helpers.js";
import { requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates tasks-status arguments before context resolution or effects. */
const tasksStatusInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now " +
    "(e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from."),
});

/** Create the tasks status SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTasksStatusTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "tasks_status",
    label: "Tasks Status",
    description:
      "Live issue dashboard from the issue tracker: issues waiting for input (hold), " +
      "work in progress (active), and queued for work (queue) — with issue details. " +
      "Use `project_status` for instant local info, `task_list` to filter/search issues.",
    parameters: toolInputParameters(tasksStatusInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = tasksStatusInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const channelId = resolveChannelId(toolCtx, params.channelId);

      const { project } = await resolveProject(workspaceDir, channelId);
      const { provider } = await resolveProvider(workspaceDir, project, ctx.runCommand);

      const projectConfig = await loadConfig(workspaceDir, project.slug);
      const status = await getManagedTaskStatus({
        workspaceDir,
        projectSlug: project.slug,
        workflow: projectConfig.workflow,
        roles: Object.keys(projectConfig.roles),
        provider,
      });

      await auditLog(workspaceDir, "tasks_status", {
        project: project.name,
        totalHold: status.summary.totalHold,
        totalActive: status.summary.totalActive,
        totalQueued: status.summary.totalQueued,
      });

      return jsonResult({
        success: true,
        project: project.name,
        stateLabels: status.stateLabels,
        summary: status.summary,
        hold: status.hold,
        active: status.active,
        queue: status.queue,
      });
    },
  });
}
