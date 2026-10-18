/**
 * channel_link — Attach this chat to a project.
 *
 * Links an exact account/chat route to a registered project after validating
 * its owning agent and OpenClaw binding. Existing project ownership is never
 * changed implicitly.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { linkProjectChannel } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { NOTIFICATION_CHANNEL } from "../../../domain/index.js";
import { requireWorkspaceDir } from "../../context/index.js";
import { channelIdInput, requiredTextInput, toolInputParameters } from "../../validation/index.js";
import { CHANNEL_LINK_TOOL_NAME } from "./const.js";

/** Validates channel-link arguments before context resolution or effects. */
const channelLinkInput = z.strictObject({
  channelId: channelIdInput,
  accountId: requiredTextInput.describe("Explicit OpenClaw channel account ID for this destination."),
  project: requiredTextInput.describe("Project name or slug to link to (e.g. 'devclaw'). Must already be registered via project_register."),
  channel: z.enum(Object.values(NOTIFICATION_CHANNEL)).describe("Channel type. Defaults to 'telegram'.").optional(),
  threadId: requiredTextInput.describe("Optional thread/topic ID for forum-style channels, e.g. Telegram topic ID.").optional(),
  name: requiredTextInput.describe("Display name for this channel (e.g. 'general', 'dev-chat'). Auto-generated if omitted.").optional(),
});

/** Create the channel link SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createChannelLinkTool(ctx: PluginContext): OpenClawPluginToolFactory {

  return (toolCtx: OpenClawPluginToolContext) => ({
    name: CHANNEL_LINK_TOOL_NAME,
    label: "Channel Link",
    description:
      "Link an explicitly bound account/chat route to a project. Conflicting project ownership is rejected.",
    parameters: toolInputParameters(channelLinkInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = channelLinkInput.parse(rawParams);
      const agentId = toolCtx.agentId;

      if (!agentId) throw new Error("Channel linking requires an agent context.");
      const result = await linkProjectChannel({ workspaceDir: requireWorkspaceDir(toolCtx), projectRef: params.project,
        agentId, getConfig: () => ctx.runtime.config.current(), name: params.name,
        route: { channel: params.channel ?? NOTIFICATION_CHANNEL.TELEGRAM, accountId: params.accountId.trim(),
          channelId: params.channelId, threadId: params.threadId?.trim() } });

      return jsonResult({ success: true, changed: result.changed, project: result.project.name, projectSlug: result.project.slug,
        channelId: result.endpoint.channelId, accountId: result.endpoint.accountId, threadId: result.endpoint.threadId,
        channelName: result.endpoint.name,
        announcement: result.changed ? `Channel linked to "${result.project.name}".` : `Channel already linked to "${result.project.name}".` });
    },
  });
}
