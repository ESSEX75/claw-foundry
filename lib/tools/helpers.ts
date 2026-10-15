/**
 * tool-helpers.ts — Shared resolution helpers for tool execute() functions.
 *
 * Eliminates repeated boilerplate across tools: workspace validation,
 * and required destination input. Project and provider resolution belong to application/projects.
 */

import type { OpenClawPluginToolContext } from "openclaw/plugin-sdk/core";

import { requiredTextInput } from "./validation/index.js";

/**
 * Require workspaceDir from context or throw a clear error.
 * @param ctx - SDK invocation context containing the resolved workspace.
 */
export function requireWorkspaceDir(ctx: OpenClawPluginToolContext): string {
  if (!ctx.workspaceDir) {
    throw new Error("No workspace directory available in tool context");
  }

  return requiredTextInput.parse(ctx.workspaceDir);
}

/**
 * Resolve the channelId from explicit tool param.
 * @param _ctx - SDK context; never used to guess an omitted destination.
 * @param explicitChannelId - Untrusted explicit conversation identifier.
 */
export function resolveChannelId(_ctx: OpenClawPluginToolContext, explicitChannelId?: unknown): string {
  if (explicitChannelId === undefined) {
    throw new Error(
      "channelId is required. Pass YOUR chat/group ID (the numeric ID of the chat you are in right now).",
    );
  }

  return requiredTextInput.parse(explicitChannelId);
}
