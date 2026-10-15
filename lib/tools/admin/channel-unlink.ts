/**
 * channel_unlink — Remove a channel from a project.
 *
 * Unlinks a channel from a project. Validates that the channel
 * exists and prevents removing the last channel from a project (projects must
 * have at least one notification endpoint).
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { unlinkProjectChannel } from "../../application/index.js";
import { NOTIFICATION_CHANNEL } from "../../domain/index.js";
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
      const result = await unlinkProjectChannel({ workspaceDir: requireWorkspaceDir(toolCtx), projectRef: params.project,
        route: { channel: params.channel, accountId: params.accountId.trim(), channelId: params.channelId, threadId: params.threadId?.trim() },
        confirm: params.confirm === true });
      const { project, endpoint } = result;
      const remainingChannels = project.channels.length - (result.changed ? 0 : 1);

      return jsonResult({ success: result.changed, dryRun: !result.changed, project: project.name, projectSlug: project.slug,
        channelId: endpoint.channelId, accountId: endpoint.accountId, threadId: endpoint.threadId,
        channelName: endpoint.name, channelType: endpoint.channel, remainingChannels,
        announcement: result.changed ? `Channel "${endpoint.name}" unlinked from "${project.name}". ${remainingChannels} channel(s) remaining.`
          : `DRY-RUN: Would remove "${endpoint.name}" from "${project.name}". Set confirm=true to proceed.` });
    },
  });
}
