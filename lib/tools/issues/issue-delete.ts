/**
 * Exposes explicitly confirmed single-issue deletion to an agent conversation.
 * The adapter resolves the bound project and delegates every destructive decision to application code.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { deleteManagedIssue, resolveProjectByRoute, resolveProvider, validateProjectRoute } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { NOTIFICATION_CHANNEL } from "../../domain/index.js";
import { requireWorkspaceDir } from "../helpers.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates issue-delete arguments before context resolution or effects. */
const issueDeleteInput = z.strictObject({
  channel: z.enum(NOTIFICATION_CHANNEL).describe("Current OpenClaw channel type."),
  accountId: requiredTextInput.trim().describe("Current explicit channel account ID."),
  channelId: requiredTextInput.trim().describe("Current bound chat/group ID used to resolve the project."),
  threadId: requiredTextInput.trim().describe("Current topic/thread ID when applicable.").optional(),
  issueId: issueIdInput.describe("Provider issue number to delete."),
  confirmIssueId: issueIdInput.describe("Must exactly match issueId when dryRun is false.").optional(),
  dryRun: z.boolean().describe("Preview only; defaults to true.").optional(),
});

/** Create the capability-aware issue_delete tool. */
export function createIssueDeleteTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "issue_delete",
    label: "Delete Issue",
    description: "Preview or explicitly confirm deletion of one provider issue and archive a local tombstone.",
    parameters: toolInputParameters(issueDeleteInput),
    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = issueDeleteInput.parse(rawParams);
      const channelId = params.channelId;
      const accountId = params.accountId;
      const channel = params.channel;
      const threadId = params.threadId;
      const issueId = params.issueId;
      const confirmIssueId = params.confirmIssueId;
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const { project, endpoint } = await resolveProjectByRoute(workspaceDir,
        { channel, accountId, channelId, threadId });

      validateProjectRoute(ctx.runtime.config.current(), project.agentId, endpoint);

      if (toolCtx.agentId && toolCtx.agentId !== project.agentId) {
        throw new Error(`Project "${project.slug}" belongs to agent "${project.agentId}", not "${toolCtx.agentId}".`);
      }

      const { provider } = await resolveProvider(workspaceDir, project, ctx.runCommand);
      const result = await deleteManagedIssue({
        workspaceDir,
        projectSlug: project.slug,
        issueId,
        confirmIssueId,
        dryRun: params.dryRun !== false,
        provider,
        actor: toolCtx.agentId ?? "agent",
      });

      return jsonResult({ success: result.dryRun || (result.deleted && result.archived), ...result });
    },
  });
}
