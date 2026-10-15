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

import { resolveProject, resolveProvider } from "../../application/index.js";
import { log as auditLog } from "../../audit.js";
import type { PluginContext } from "../../context.js";
import { getFallbackEmoji } from "../../roles/index.js";
import { isConfiguredRoleId, loadConfig } from "../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../helpers.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates task-comment arguments before context resolution or effects. */
const taskCommentInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now " +
    "(e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from."),
  issueId: issueIdInput.describe("Issue ID to comment on"),
  body: requiredTextInput.describe("Comment body in markdown. Supports GitHub-flavored markdown."),
  authorRole: requiredTextInput.describe("Optional configured role attribution, or orchestrator.").optional(),
});

/** Create the task comment SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskCommentTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "task_comment",
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

      const { project } = await resolveProject(workspaceDir, channelId);
      const config = await loadConfig(workspaceDir, project.slug);

      if (authorRole && authorRole !== "orchestrator" && !isConfiguredRoleId(config, authorRole)) {
        throw new Error(`Unknown comment author role "${authorRole}".`);
      }

      const { provider, type: providerType } = await resolveProvider(workspaceDir, project, ctx.runCommand);

      const issue = await provider.getIssue(issueId);

      const commentBody = authorRole
        ? `${getRoleEmoji(authorRole)} **${authorRole.toUpperCase()}**: ${body}`
        : body;

      const commentId = await provider.addComment(issueId, commentBody);

      // Mark as system-managed (best-effort).
      provider.reactToIssueComment(issueId, commentId, "eyes").catch(() => {});

      await auditLog(workspaceDir, "task_comment", {
        project: project.name, issueId,
        authorRole: authorRole ?? null,
        bodyPreview: body.slice(0, 100) + (body.length > 100 ? "..." : ""),
        provider: providerType,
      });

      return jsonResult({
        success: true, issueId, issueTitle: issue.title, issueUrl: issue.web_url,
        commentAdded: true, authorRole: authorRole ?? null, bodyLength: body.length,
        project: project.name, provider: providerType,
        announcement: `💬 Comment added to #${issueId}${authorRole ? ` by ${authorRole.toUpperCase()}` : ""}`,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function getRoleEmoji(role: string): string {
  if (role === "orchestrator") return "🎛️";

  return getFallbackEmoji(role);
}
