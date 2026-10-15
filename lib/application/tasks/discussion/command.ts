/** Owns configured comment attribution, provider publication and best-effort acknowledgement. */

import { log as auditLog } from "../../../audit.js";
import { getFallbackEmoji } from "../../../roles/index.js";
import { isConfiguredRoleId, loadConfig } from "../../../state/index.js";
import { resolveProject, resolveProvider } from "../../projects/index.js";
import { EYES_EMOJI } from "../../review/index.js";
import { TASK_COMMENT_EVENT, TASK_COMMENT_PREVIEW_LENGTH } from "./const.js";
import type { CommentOnTaskInput } from "./types.js";

/** Publish one comment after role validation; never infer workflow state from provider observations.
 * Comments are non-idempotent provider effects and are never automatically replayed.
 * @param input - Validated discussion request and provider transport.
 */
export async function commentOnTask(input: CommentOnTaskInput) {
  const { workspaceDir, channelId, issueId, body, authorRole } = input;
  const { project } = await resolveProject(workspaceDir, channelId);
  const config = await loadConfig(workspaceDir, project.slug);

  if (authorRole && authorRole !== "orchestrator" && !isConfiguredRoleId(config, authorRole)) {
    throw new Error(`Unknown comment author role "${authorRole}".`);
  }

  const resolved = input.provider ? { provider: input.provider, type: project.provider }
    : await resolveProvider(workspaceDir, project, input.runCommand);
  const { provider, type: providerType } = resolved;

  const issue = await provider.getIssue(issueId);

  const commentBody = authorRole
    ? `${getRoleEmoji(authorRole)} **${authorRole.toUpperCase()}**: ${body}`
    : body;

  const commentId = await provider.addComment(issueId, commentBody);

  // Mark as system-managed (best-effort).
  await provider.reactToIssueComment(issueId, commentId, EYES_EMOJI).catch(() => {});

  let auditError: string | undefined;

  try {
    await auditLog(workspaceDir, TASK_COMMENT_EVENT, {
      project: project.name, issueId,
      authorRole: authorRole ?? null,
      bodyPreview: body.slice(0, TASK_COMMENT_PREVIEW_LENGTH) + (body.length > TASK_COMMENT_PREVIEW_LENGTH ? "..." : ""),
      provider: providerType,
    });
  } catch (error) {
    auditError = error instanceof Error ? error.message : String(error);
  }

  return {
    success: true, issueId, issueTitle: issue.title, issueUrl: issue.web_url,
    auditError, commentAdded: true, authorRole: authorRole ?? null, bodyLength: body.length,
    project: project.name, provider: providerType,
    announcement: `💬 Comment added to #${issueId}${authorRole ? ` by ${authorRole.toUpperCase()}` : ""}`,
  };
}

/** Resolve visual attribution for a validated author role.
 * @param role - Configured role identifier or orchestrator.
 */
function getRoleEmoji(role: string): string {
  if (role === "orchestrator") return "🎛️";

  return getFallbackEmoji(role);
}
