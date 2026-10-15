/**
 * task_comment — Add review comments or notes to an issue.
 *
 * Use cases:
 * - Tester worker adds review feedback without blocking pass/fail
 * - Developer worker posts implementation notes
 * - Orchestrator adds summary comments
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { commentOnTask } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { requireWorkspaceDir, resolveChannelId } from "../../context/index.js";
import { channelIdInput, issueIdInput, requiredTextInput, toolInputParameters } from "../../validation/index.js";
import { TASK_COMMENT_TOOL_NAME } from "./const.js";

/** Validates task-comment arguments before context resolution or effects. */
const taskCommentInput = z.strictObject({
  channelId: channelIdInput,
  issueId: issueIdInput.describe("Issue ID to comment on"),
  body: requiredTextInput.describe("Comment body in markdown. Supports GitHub-flavored markdown."),
  authorRole: requiredTextInput.describe("Optional configured role attribution, or orchestrator.").optional(),
});

/** Create the task comment SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskCommentTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: TASK_COMMENT_TOOL_NAME,
    label: "Task Comment",
    description: `Add a comment to an issue. Use this for review feedback, implementation notes, or any discussion that doesn't require a state change.

Use cases:
- Tester adds review feedback without blocking pass/fail
- Developer posts implementation notes or progress updates
- Orchestrator adds summary comments
- Cross-referencing related issues or PRs

Examples:
- Simple: { issueId: 42, body: "Found an edge case with null inputs" }
- With role: { issueId: 42, body: "LGTM!", authorRole: "tester" }
- Detailed: { issueId: 42, body: "## Notes\\n\\n- Tested on staging\\n- All checks passing", authorRole: "developer" }`,
    parameters: toolInputParameters(taskCommentInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskCommentInput.parse(rawParams);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const issueId = params.issueId;
      const body = params.body;
      const authorRole = params.authorRole;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      return jsonResult(await commentOnTask({ workspaceDir, channelId, issueId, body, authorRole, runCommand: ctx.runCommand }));
    },
  });
}
