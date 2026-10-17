/**
 * task_set_level — Set the developer level hint on a HOLD-state issue.
 *
 * Restricted to HOLD states only (Planning, Refining). The assignment is
 * stored locally for the target queue role and projected as a provider label.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { setTaskLevel } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { requireWorkspaceDir, resolveChannelId } from "../../context/index.js";
import { channelIdInput, issueIdInput, requiredTextInput, toolInputParameters } from "../../validation/index.js";
import { TASK_SET_LEVEL_TOOL_NAME } from "./const.js";

/** Validates task-set-level arguments before context resolution or effects. */
const taskSetLevelInput = z.strictObject({
  channelId: channelIdInput,
  issueId: issueIdInput.describe("Issue ID to update"),
  level: requiredTextInput.describe("Override the role:level hint (e.g., 'senior', 'junior'). Applied so the heartbeat dispatches " +
    "with this level when the issue is advanced via task_start."),
  reason: z.string().describe("Optional audit log reason for the change").optional(),
});

/** Create the task set level SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskSetLevelTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: TASK_SET_LEVEL_TOOL_NAME,
    label: "Task Set Level",
    description:
      `Set the target role level on a HOLD-state issue (Planning, Refining). ` +
      `The assignment is saved in local issue state and used when task_start advances the issue.

Examples:
- { channelId: "-1003844794417", issueId: 42, level: "senior" }
- { channelId: "-1003844794417", issueId: 42, level: "junior", reason: "Simple typo fix" }`,
    parameters: toolInputParameters(taskSetLevelInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskSetLevelInput.parse(rawParams);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const issueId = params.issueId;
      const newLevel = params.level;
      const reason = params.reason;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      const result = await setTaskLevel({
        workspaceDir,
        channelId,
        issueId,
        level: newLevel,
        ...(reason ? { reason } : {}),
        runCommand: ctx.runCommand,
      });

      const announcement = result.changed
        ? `🔧 Updated #${result.issueId}: level ${result.fromLevel ?? "none"} → ${result.level}`
          + (result.reason ? ` (${result.reason})` : "")
        : `Issue #${result.issueId} already has level "${result.level}".`;

      return jsonResult({ ...result, announcement });
    },
  });
}
