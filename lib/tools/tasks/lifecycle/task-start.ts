/**
 * task_start — Advance an issue to the next queue in the workflow.
 *
 * The heartbeat is the sole dispatcher — this tool only places issues in
 * queues, never dispatches workers directly.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { startTask } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { requireWorkspaceDir, resolveChannelId } from "../../context/index.js";
import { channelIdInput, issueIdInput, requiredTextInput, toolInputParameters } from "../../validation/index.js";
import { TASK_START_TOOL_NAME } from "./const.js";

/** Validates task-start arguments before context resolution or effects. */
const taskStartInput = z.strictObject({
  channelId: channelIdInput,
  issueId: issueIdInput.describe("Issue ID to advance."),
  level: requiredTextInput.describe("Optional level assignment (e.g. 'junior', 'senior'). Overrides a level prepared for the target role.").optional(),
});

/** Create the task start SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskStartTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: TASK_START_TOOL_NAME,
    label: "Task Start",
    description:
      `Advance a HOLD-state issue to its configured queue using the APPROVE transition.

Optionally assign a level (e.g. "junior", "senior"). Without one, a prepared level for the same role is reused or selected once before queueing.
The heartbeat handles the actual dispatch — this tool only places issues in queues.

Examples:
- Start work: { channelId: "-1003844794417", issueId: 42 } → advances to next queue
- With level: { channelId: "-1003844794417", issueId: 42, level: "junior" } → advances + hints junior`,
    parameters: toolInputParameters(taskStartInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskStartInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const issueId = params.issueId;
      const level = params.level;

      return jsonResult(await startTask({
        workspaceDir,
        channelId,
        issueId,
        level,
        runCommand: ctx.runCommand,
      }));
    },
  });
}
