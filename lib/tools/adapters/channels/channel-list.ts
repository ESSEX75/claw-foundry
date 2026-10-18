/**
 * channel_list — List channels for a project or all projects.
 *
 * Shows registered channels with their type, ID, and name.
 * Can list channels for a specific project or all projects.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { selectProject } from "../../../application/index.js";
import { readProjects } from "../../../state/index.js";
import { requireWorkspaceDir } from "../../context/index.js";
import { requiredTextInput, toolInputParameters } from "../../validation/index.js";
import { CHANNEL_LIST_TOOL_NAME } from "./const.js";

/** Validates channel-list arguments before context resolution or effects. */
const channelListInput = z.strictObject({
  project: requiredTextInput.describe("Project name or slug to list channels for. Omit to list channels for all projects.").optional(),
});

/** Create the channel list SDK adapter with validated command input. */
export function createChannelListTool(): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: CHANNEL_LIST_TOOL_NAME,
    label: "Channel List",
    description:
      "List channels for a project or all projects. Shows channel type, ID, and name.",
    parameters: toolInputParameters(channelListInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = channelListInput.parse(rawParams);
      const projectRef = params.project;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      const data = await readProjects(workspaceDir);

      if (projectRef) {
        const target = selectProject(data, projectRef);

        const channels = target.channels.map((ch) => ({
          channelId: ch.channelId,
          type: ch.channel,
          name: ch.name,
          accountId: ch.accountId,
          threadId: ch.threadId,
        }));

        const announcement =
          `**Channels for project "${target.name}"** (${channels.length}):\n\n` +
          (channels.length === 0
            ? "_(none)_"
            : channels
              .map(
                (ch) =>
                  `• **${ch.name}** (${ch.type})\n  ID: \`${ch.channelId}\`${ch.accountId ? `\n  Account: ${ch.accountId}` : ""
                  }${ch.threadId ? `\n  Thread: ${ch.threadId}` : ""
                  }`,
              )
              .join("\n\n"));

        return jsonResult({
          success: true,
          project: target.name,
          projectSlug: target.slug,
          channels,
          announcement,
        });
      } else {
        // List channels for all projects
        const projects = Object.values(data.projects);

        if (projects.length === 0) {
          return jsonResult({
            success: true,
            projects: [],
            announcement: "No projects registered.",
          });
        }

        const projectChannels = projects.map((p) => ({
          project: p.name,
          projectSlug: p.slug,
          channels: p.channels.map((ch) => ({
            channelId: ch.channelId,
            type: ch.channel,
            name: ch.name,
            accountId: ch.accountId,
            threadId: ch.threadId,
          })),
        }));

        const announcement =
          "**Channels by project:**\n\n" +
          projectChannels
            .map((p) => {
              const channelList =
                p.channels.length === 0
                  ? "  _(no channels)_"
                  : p.channels
                    .map(
                      (ch) =>
                        `  • **${ch.name}** (${ch.type}) — \`${ch.channelId}\`${ch.threadId ? ` / thread ${ch.threadId}` : ""}`,
                    )
                    .join("\n");

              return `**${p.project}** (${p.projectSlug}):\n${channelList}`;
            })
            .join("\n\n");

        return jsonResult({
          success: true,
          projects: projectChannels,
          announcement,
        });
      }
    },
  });
}
