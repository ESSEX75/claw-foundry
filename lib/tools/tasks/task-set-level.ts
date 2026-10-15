/**
 * task_set_level — Set the developer level hint on a HOLD-state issue.
 *
 * Restricted to HOLD states only (Planning, Refining). The assignment is
 * stored locally for the target queue role and projected as a provider label.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { setTaskLevel } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { requireWorkspaceDir, resolveChannelId } from "../helpers.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates task-set-level arguments before context resolution or effects. */
const taskSetLevelInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now " +
    "(e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from."),
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
    name: "task_set_level",
    label: "Task Set Level",
    description:
      `Set the target role level on a HOLD-state issue (Planning, Refining). ` +
      `The assignment is saved in local issue state and used when task_start advances the issue.

Examples:
- { issueId: 42, level: "senior" }
- { issueId: 42, level: "junior", reason: "Simple typo fix" }`,
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

      return jsonResult(await setTaskLevel({
        workspaceDir,
        channelId,
        issueId,
        level: newLevel,
        ...(reason ? { reason } : {}),
        runCommand: ctx.runCommand,
      }));
    },
  });
}
