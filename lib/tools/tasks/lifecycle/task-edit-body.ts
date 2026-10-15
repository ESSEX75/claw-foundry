/**
 * task_edit_body — Update issue title and/or description through the task
 * application use case.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { editTaskBody } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { requireWorkspaceDir, resolveChannelId } from "../../context/index.js";
import { channelIdInput, issueIdInput, toolInputParameters } from "../../validation/index.js";
import { TASK_EDIT_BODY_TOOL_NAME } from "./const.js";

/** Validates task-edit-body arguments before context resolution or effects. */
const taskEditBodyInput = z.strictObject({
  channelId: channelIdInput,
  issueId: issueIdInput.describe("Issue ID to edit"),
  title: z.string().describe("New title for the issue (optional)").optional(),
  body: z.string().describe("New body/description for the issue (optional)").optional(),
  reason: z.string().describe("Why the edit was made (optional, for audit trail)").optional(),
  addComment: z.boolean().describe("Post an auto-comment on the issue noting the edit (default: true)").optional(),
});

/** Create the task edit body SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskEditBodyTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: TASK_EDIT_BODY_TOOL_NAME,
    label: "Task Edit Body",
    description: `Update issue title and/or description. Only allowed in the initial workflow state (e.g. "Planning") — prevents editing in-progress work.

Logs the edit to the audit trail with timestamp, caller, and a diff summary.
Optionally posts an auto-comment on the issue for traceability.

Examples:
- Fix typo: { issueId: 42, title: "Fix login timeout bug" }
- Clarify scope: { issueId: 42, body: "Updated requirements...", reason: "Clarified after meeting" }
- Silent edit: { issueId: 42, body: "...", addComment: false }`,
    parameters: toolInputParameters(taskEditBodyInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskEditBodyInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const channelId = resolveChannelId(toolCtx, params.channelId);

      return jsonResult(await editTaskBody({
        workspaceDir,
        channelId,
        issueId: params.issueId,
        title: params.title,
        body: params.body,
        reason: params.reason,
        addComment: params.addComment,
        runCommand: ctx.runCommand,
      }));
    },
  });
}
