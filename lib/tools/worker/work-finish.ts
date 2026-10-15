/**
 * work_finish — Complete active worker work through the worker application use case.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { finishWork } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { requireWorkspaceDir, resolveChannelId } from "../helpers.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates work-finish arguments before context resolution or effects. */
const workFinishInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now " +
    "(e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from."),
  role: requiredTextInput.describe("Configured worker role"),
  result: requiredTextInput.describe("Completion result"),
  summary: z.string().describe("Brief summary").optional(),
  prUrl: z.string().describe("PR/MR URL (auto-detected if omitted)").optional(),
  createdTasks: z.array(z.strictObject({
    id: issueIdInput.describe("Issue ID"),
    title: requiredTextInput.describe("Issue title"),
    url: requiredTextInput.describe("Issue URL"),
  })).describe("Tasks created during this work session (architect creates implementation tasks).").optional(),
});

/** Create the work finish SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createWorkFinishTool(ctx: Pick<PluginContext, "runCommand" | "pluginConfig"> & Partial<Pick<PluginContext, "runtime">>): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "work_finish",
    label: "Work Finish",
    description:
      `Complete a task: Developer done (PR created, goes to review) or blocked. ` +
      `Tester pass/fail/refine/blocked. Reviewer approve/reject/blocked. Architect done/blocked. ` +
      `Handles label transition, state update, issue close/reopen, notifications, and audit logging.`,
    parameters: toolInputParameters(workFinishInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = workFinishInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const channelId = resolveChannelId(toolCtx, params.channelId);

      return jsonResult(await finishWork({
        workspaceDir,
        channelId,
        role: params.role,
        result: params.result,
        summary: params.summary,
        prUrl: params.prUrl,
        createdTasks: params.createdTasks,
        sessionKey: toolCtx.sessionKey,
        runCommand: ctx.runCommand,
        runtime: ctx.runtime,
        pluginConfig: ctx.pluginConfig,
      }));
    },
  });
}
