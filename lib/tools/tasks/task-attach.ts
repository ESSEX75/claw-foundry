/**
 * task_attach — Attach files to issues or list existing attachments.
 *
 * Use cases:
 * - List attachments on an issue (for architects/developers)
 * - Manually attach a local file to an issue
 * - View attachment metadata and local paths
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { manageTaskAttachments } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { requireWorkspaceDir, resolveChannelId } from "../helpers.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates task-attach arguments before context resolution or effects. */
const taskAttachInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now " +
    "(e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from."),
  issueId: issueIdInput.describe("Issue ID"),
  action: z.enum(["list", "add", "get"]).describe("Action to perform. Defaults to 'list'.").optional(),
  filePath: requiredTextInput.describe("Local file path to attach (required for 'add' action).").optional(),
  attachmentId: requiredTextInput.describe("Attachment ID to retrieve (required for 'get' action).").optional(),
});

/** Register manual attachment commands through application orchestration.
 * @param ctx - Provider transport and runtime diagnostics.
 */
export function createTaskAttachTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "task_attach",
    label: "Task Attach",
    description: `Manage file attachments on issues. List existing attachments or add new ones from local files.

Use cases:
- List attachments: { issueId: 42, action: "list" }
- Attach file: { issueId: 42, action: "add", filePath: "/path/to/file.png" }
- Get attachment path: { issueId: 42, action: "get", attachmentId: "abc-123" }`,
    parameters: toolInputParameters(taskAttachInput),

    /** Validate the request and format the shared application result.
     * @param _id - SDK tool invocation identifier.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const input = taskAttachInput.parse(rawParams);

      return jsonResult(await manageTaskAttachments({ ...input, action: input.action ?? "list",
        channelId: resolveChannelId(toolCtx, input.channelId), workspaceDir: requireWorkspaceDir(toolCtx), runCommand: ctx.runCommand }));
    },
  });
}
