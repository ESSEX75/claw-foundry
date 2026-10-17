/** Validates requested setup identities and resolves existing workspaces through the SDK adapter. */

import { findConfiguredAgent, resolveConfiguredAgentWorkspace } from "../../../integrations/index.js";
import type { SetupRuntime } from "../types.js";
import { MAIN_AGENT_ID } from "./const.js";

/** Convert an agent display name to its stable OpenClaw identifier.
 * @param name - Requested display name; empty identifiers and main are rejected.
 */
export function getAgentId(name: string): string {
  const agentId = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!agentId) throw new Error(`Invalid agent name: "${name}"`);
  if (agentId === MAIN_AGENT_ID) throw new Error('"main" is reserved. Choose another agent name.');

  return agentId;
}

/**
 * Resolve the effective SDK workspace, rejecting agents absent from the configuration.
 * @param runtime - Read-only configuration source.
 * @param agentId - Existing agent identifier.
 */
export async function resolveWorkspacePath(runtime: SetupRuntime, agentId: string): Promise<string> {
  const cfg = runtime.config.current();
  const agent = findConfiguredAgent(cfg, agentId);

  if (!agent) {
    throw new Error(`Agent "${agentId}" not found in openclaw.json.`);
  }

  return resolveConfiguredAgentWorkspace(cfg, agentId);
}
