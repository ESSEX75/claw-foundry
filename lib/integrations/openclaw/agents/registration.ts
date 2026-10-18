/** Registers one explicit agent through the SDK configuration transaction without filesystem effects. */

import { findConfiguredAgent } from "./registry.js";
import type { AgentRegistrationInput } from "./types.js";

/** Register only an absent identity in the fresh SDK draft; caller coordinates resource provisioning.
 * @param input - Configuration capability, normalized identity, resource plan and caller reload policy.
 */
export async function registerAgentConfiguration(input: AgentRegistrationInput): Promise<void> {
  const { runtime, agentId, name, resources, afterWrite } = input;

  if (agentId !== resources.agentId) throw new Error("Agent resource plan has a different identity.");
  await runtime.config.mutateConfigFile({
    /** Reject a concurrent registration before modifying the active inventory.
     * @param config - Fresh mutable SDK configuration draft.
     */
    mutate(config) {
      if (findConfiguredAgent(config, agentId)) throw new Error(`Agent "${agentId}" already exists in openclaw.json.`);
      config.agents ??= {};
      const defaultsModel = config.agents.defaults?.model;
      const model = typeof defaultsModel === "string" ? defaultsModel : defaultsModel?.primary;
      const entry = { name, workspace: resources.workspacePath, agentDir: resources.agentDirectory, ...(model ? { model } : {}) };

      if (config.agents.entries !== undefined) config.agents.entries[agentId] = entry;
      else {
        config.agents.list ??= [];
        config.agents.list.push({ id: agentId, ...entry });
      }
    },
    afterWrite,
  });
}
