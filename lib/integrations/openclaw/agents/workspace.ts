/** Resolves effective agent workspaces through the installed OpenClaw SDK contract. */

import { projectAgentConfiguration } from "./sdk-config.js";
import type { AgentRegistryConfig } from "./types.js";

/** Resolve explicit and implicit workspaces without duplicating SDK fallback rules.
 * @param config - Fresh SDK configuration snapshot.
 * @param agentId - Configured agent whose project ownership will be inspected.
 */
export async function resolveConfiguredAgentWorkspace(config: AgentRegistryConfig, agentId: string): Promise<string> {
  const { resolveAgentWorkspaceDir } = await import("openclaw/plugin-sdk/agent-runtime");

  return resolveAgentWorkspaceDir(projectAgentConfiguration(config), agentId);
}
