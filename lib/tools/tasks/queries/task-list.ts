/**
 * task_list — Browse issues by workflow state.
 *
 * Lists issues grouped by state label with optional filtering by state type,
 * specific label, or text search. Supports terminal (closed) issues.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { ALL_TASK_STATES, listManagedTasks, resolveProject, resolveProvider } from "../../../application/index.js";
import { log as auditLog } from "../../../audit.js";
import type { PluginContext } from "../../../context.js";
import { STATE_TYPE } from "../../../domain/index.js";
import { loadConfig } from "../../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../../context/index.js";
import { channelIdInput, toolInputParameters } from "../../validation/index.js";
import { TASK_LIST_TOOL_NAME } from "./const.js";

/** Validates task-list arguments before context resolution or effects. */
const taskListInput = z.strictObject({
  channelId: channelIdInput,
  stateType: z.enum([...Object.values(STATE_TYPE), ALL_TASK_STATES]).describe("Filter by state type. Defaults to all non-terminal states.").optional(),
  label: z.string().describe("Filter by specific state label (e.g. 'Planning', 'Done'). Overrides stateType.").optional(),
  search: z.string().describe("Text search in issue titles (case-insensitive).").optional(),
  limit: z.number().int().safe().min(0).describe("Max issues per state. Defaults to 20.").optional(),
});

/** Create the task list SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskListTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: TASK_LIST_TOOL_NAME,
    label: "Task List",
    description:
      `Browse issues for a project by workflow state. Shows issues grouped by state label. ` +
      `Use \`tasks_status\` for a quick issue dashboard, this tool for filtered browsing.`,
    parameters: toolInputParameters(taskListInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskListInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const stateType = params.stateType;

      const label = params.label;
      const search = params.search;
      const limit = params.limit;

      const { project } = await resolveProject(workspaceDir, channelId);
      const { provider } = await resolveProvider(workspaceDir, project, ctx.runCommand);
      const projectConfig = await loadConfig(workspaceDir, project.slug);
      const result = await listManagedTasks({
        workspaceDir,
        projectSlug: project.slug,
        workflow: projectConfig.workflow,
        roles: Object.keys(projectConfig.roles),
        provider,
        stateType,
        label,
        search,
        limit,
      });

      await auditLog(workspaceDir, TASK_LIST_TOOL_NAME, {
        project: project.name,
        stateType: stateType ?? (label ? undefined : "non-terminal"),
        label,
        search,
        totalIssues: result.totalIssues,
      });

      return jsonResult({
        success: true,
        project: project.name,
        filter: result.filter,
        states: result.states,
        totalIssues: result.totalIssues,
      });
    },
  });
}
