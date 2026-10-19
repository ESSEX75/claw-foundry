/** Resolves an existing or proposed setup agent for read-only endpoint discovery. */

import { findConfiguredAgent } from "../../integrations/index.js";
import { type RouteConfig } from "../project-routing/index.js";
import { getAgentId } from "./agents/index.js";
import { listChannelBindingChoices, type SetupEndpointChoice } from "./bindings/index.js";
import type { SetupEndpointChoicesInput } from "./types.js";

/** Inspect exact endpoints without creating an agent, workspace, binding, or scope request.
 * New agents participate only in an immutable proposed roster; apply revalidates fresh SDK state.
 * @param input - Explicit existing agent or new-agent name and read-only configuration reader.
 */
export function getSetupEndpointChoices(input: SetupEndpointChoicesInput): SetupEndpointChoice[] {
  if (input.newAgentName && input.agentId) throw new Error("newAgentName cannot be combined with agentId.");
  const agentId = input.newAgentName ? getAgentId(input.newAgentName) : input.agentId;

  if (!agentId?.trim()) throw new Error("Endpoint discovery requires an existing or proposed agent.");
  const config = input.runtime.config.current();
  const existing = findConfiguredAgent(config, agentId);

  if (input.newAgentName && existing) throw new Error(`Agent "${agentId}" already exists in openclaw.json.`);
  if (!input.newAgentName && !existing) throw new Error(`Agent "${agentId}" does not exist.`);
  const proposed: RouteConfig = input.newAgentName ? {
    ...config,
    agents: config.agents?.entries !== undefined
      ? { entries: { ...config.agents.entries, [agentId]: {} } }
      : { list: [...(config.agents?.list ?? []), { id: agentId }] },
  } : config;

  return listChannelBindingChoices(proposed, agentId);
}
