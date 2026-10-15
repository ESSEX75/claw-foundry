/**
 * channel_link — Attach this chat to a project.
 *
 * Links an exact account/chat route to a registered project after validating
 * its owning agent and OpenClaw binding. Existing project ownership is never
 * changed implicitly.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import {
  validateDestinationAvailability,
  validateProjectRoute,
} from "../../application/index.js";
import { log as auditLog } from "../../audit.js";
import type { PluginContext } from "../../context.js";
import {
  NOTIFICATION_CHANNEL,
  type NotificationEndpoint,
} from "../../domain/index.js";
import { readProjects, updateProjects } from "../../state/index.js";
import { requireWorkspaceDir } from "../helpers.js";
import { requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates channel-link arguments before context resolution or effects. */
const channelLinkInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now (e.g. '-1003844794417'). " +
    "Do NOT guess; use the ID of the conversation this message came from."),
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
    name: "channel_link",
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
      const channelId = params.channelId;
      const accountId = params.accountId.trim();
      const projectRef = params.project;
      const channelType = params.channel ?? NOTIFICATION_CHANNEL.TELEGRAM;
      const threadId = params.threadId?.trim();
      const channelName = params.name;
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const agentId = toolCtx.agentId;

      if (!agentId) throw new Error("Channel linking requires an agent context.");

      const data = await readProjects(workspaceDir);

      // Resolve target project by slug or name
      const slug = projectRef.toLowerCase().replace(/\s+/g, "-");
      const target =
        data.projects[slug] ??
        Object.values(data.projects).find(
          (p) => p.name.toLowerCase() === projectRef.toLowerCase(),
        );

      if (!target) {
        const available = Object.values(data.projects)
          .map((p) => p.name)
          .join(", ");

        throw new Error(
          `Project "${projectRef}" not found. Available projects: ${available || "none"}. ` +
          `Register a project first with project_register.`,
        );
      }

      if (target.agentId !== agentId) {
        throw new Error(`Project "${target.name}" belongs to agent "${target.agentId}", not "${agentId}".`);
      }

      const newChannel: NotificationEndpoint = {
        channelId,
        channel: channelType,
        name: channelName ?? `channel-${target.channels.length + 1}`,
        accountId,
        ...(threadId ? { threadId } : {}),
      };

      validateProjectRoute(ctx.runtime.config.current(), agentId, newChannel);
      validateDestinationAvailability(data, target.slug, newChannel);

      // Already linked to this project?
      const alreadyLinked = target.channels.some(
        (ch) => ch.channel === channelType
          && ch.accountId === accountId
          && ch.channelId === channelId
          && ch.threadId === threadId,
      );

      if (alreadyLinked) {
        return jsonResult({
          success: true,
          changed: false,
          project: target.name,
          projectSlug: target.slug,
          channelId,
          threadId,
          announcement: `Channel already linked to "${target.name}".`,
        });
      }

      const updatedTarget = await updateProjects(workspaceDir, (current) => {
        const next = structuredClone(current);
        const currentTarget = next.projects[target.slug];

        if (!currentTarget) throw new Error(`Project "${target.slug}" no longer exists.`);

        validateDestinationAvailability(next, currentTarget.slug, newChannel);
        if (!currentTarget.channels.some((candidate) => (
          candidate.channel === newChannel.channel
          && candidate.accountId === newChannel.accountId
          && candidate.channelId === newChannel.channelId
          && candidate.threadId === newChannel.threadId
        ))) currentTarget.channels.push(newChannel);

        return { data: next, result: currentTarget };
      });

      await auditLog(workspaceDir, "channel_link", {
        project: updatedTarget.name,
        projectSlug: updatedTarget.slug,
        channelId,
        accountId,
        agentId,
        threadId,
        channelType,
        channelName: newChannel.name,
      });

      return jsonResult({
        success: true,
        changed: true,
        project: updatedTarget.name,
        projectSlug: updatedTarget.slug,
        channelId,
        threadId,
        channelName: newChannel.name,
        announcement: `Channel linked to "${updatedTarget.name}".`,
      });
    },
  });
}
