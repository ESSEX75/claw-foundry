/** Exposes active agent identity and SDK workspace resolution without lifecycle decisions. */

export { findConfiguredAgent,listConfiguredAgents } from "./registry.js";
export type { AgentRegistryConfig, AgentRegistryEntry } from "./types.js";
export { resolveConfiguredAgentWorkspace } from "./workspace.js";
