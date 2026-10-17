/** Projects readonly registry inputs into the minimal mutable shape required by SDK resolvers. */

import type { AgentRegistryConfig } from "./types.js";

/** Preserve SDK entries/list precedence and only fields used by resource resolvers.
 * @param config - Fresh readonly SDK inventory.
 */
export function projectAgentConfiguration(config: AgentRegistryConfig) {
  return { agents: config.agents ? {
    defaults: config.agents.defaults ? { workspace: config.agents.defaults.workspace } : undefined,
    entries: config.agents.entries === undefined ? undefined : Object.fromEntries(
      Object.entries(config.agents.entries).map(([id, agent]) => [id, { workspace: agent.workspace, agentDir: agent.agentDir, default: agent.default }]),
    ),
    list: config.agents.list?.map(agent => ({ id: agent.id, workspace: agent.workspace, agentDir: agent.agentDir, default: agent.default })),
  } : undefined };
}
