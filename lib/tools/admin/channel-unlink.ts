/**
 * channel_unlink — Remove a channel from a project.
 *
 * Unlinks a channel from a project. Validates that the channel
 * exists and prevents removing the last channel from a project (projects must
 * have at least one notification endpoint).
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { log as auditLog } from "../../audit.js";
import { NOTIFICATION_CHANNEL } from "../../domain/index.js";
import { readProjects, updateProjects } from "../../state/index.js";
import { requireWorkspaceDir } from "../helpers.js";
import { requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates channel-unlink arguments before context resolution or effects. */
const channelUnlinkInput = z.strictObject({
  channel: z.enum(Object.values(NOTIFICATION_CHANNEL)).describe("Transport of the exact endpoint to remove."),
  accountId: requiredTextInput.describe("Explicit account ID of the exact endpoint to remove."),
  channelId: requiredTextInput.describe("Channel ID to remove (e.g., Telegram group ID)"),
  project: requiredTextInput.describe("Project name or slug to unlink the channel from"),
  threadId: requiredTextInput.describe("Optional thread/topic ID when the same channel has multiple project topics.").optional(),
  confirm: z.boolean().describe("Set to true to confirm the removal. Defaults to false (dry-run).").optional(),
});

/** Remove only the explicitly selected complete route, rechecking it under the registry lock. */
export function createChannelUnlinkTool(): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "channel_unlink",
    label: "Channel Unlink",
    description:
      "Remove a channel from a project. Validates that the channel exists and prevents " +
      "removing the last channel (projects must have at least one notification endpoint).",
    parameters: toolInputParameters(channelUnlinkInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = channelUnlinkInput.parse(rawParams);
      const channelType = params.channel;
      const accountId = params.accountId.trim();
      const channelId = params.channelId;
      const projectRef = params.project;
      const threadId = params.threadId?.trim();
      const confirm = params.confirm;
      const workspaceDir = requireWorkspaceDir(toolCtx);

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
          `Project "${projectRef}" not found. Available projects: ${available || "none"}.`,
        );
      }

      // Find the channel
      const idx = target.channels.findIndex((ch) => ch.channel === channelType && ch.accountId === accountId
        && ch.channelId === channelId && ch.threadId === threadId);

      if (idx === -1) {
        const threadNote = threadId ? ` thread ${threadId}` : "";

        throw new Error(
          `Channel ${channelId}${threadNote} not found in project "${target.name}".`,
        );
      }

      // Prevent removing the last channel
      if (target.channels.length === 1) {
        throw new Error(
          `Cannot remove the last channel from project "${target.name}". Projects must have at least one channel.`,
        );
      }

      const channel = target.channels[idx];

      // Dry-run mode: show what would be removed
      if (!confirm) {
        return jsonResult({
          success: false,
          dryRun: true,
          project: target.name,
          projectSlug: target.slug,
          channelId,
          accountId,
          threadId,
          channelName: channel.name,
          channelType: channel.channel,
          remainingChannels: target.channels.length - 1,
          announcement:
            `DRY-RUN: Would remove channel "${channel.name}" (${channelId}) from project "${target.name}". ` +
            `${target.channels.length - 1} channel(s) would remain. Set confirm=true to proceed.`,
        });
      }

      const updatedTarget = await updateProjects(workspaceDir, (current) => {
        const next = structuredClone(current);
        const currentTarget = next.projects[target.slug];

        if (!currentTarget) throw new Error(`Project "${target.slug}" no longer exists.`);
        const currentIndex = currentTarget.channels.findIndex((candidate) => (
          candidate.channel === channelType && candidate.accountId === accountId
          && candidate.channelId === channelId && candidate.threadId === threadId
        ));

        if (currentIndex === -1) throw new Error(`Channel ${channelId} is no longer linked.`);
        if (currentTarget.channels.length === 1) throw new Error("Cannot remove the last project channel.");
        currentTarget.channels.splice(currentIndex, 1);

        return { data: next, result: currentTarget };
      });

      await auditLog(workspaceDir, "channel_unlink", {
        project: target.name,
        projectSlug: target.slug,
        channelId,
        accountId,
        threadId,
        channelName: channel.name,
        channelType: channel.channel,
      });

      return jsonResult({
        success: true,
        project: target.name,
        projectSlug: target.slug,
        channelId,
        accountId,
        threadId,
        channelName: channel.name,
        channelType: channel.channel,
        remainingChannels: updatedTarget.channels.length,
        announcement:
          `Channel "${channel.name}" (${channelId}) unlinked from project "${target.name}". ` +
          `${updatedTarget.channels.length} channel(s) remaining.`,
      });
    },
  });
}
