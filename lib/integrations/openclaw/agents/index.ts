/** Exposes SDK agent identity, resource resolution and explicit registration/provisioning adapters. */

export { registerAgentConfiguration } from "./registration.js";
export { findConfiguredAgent,listConfiguredAgents } from "./registry.js";
export { provisionAgentResources, provisionConfiguredAgentResources, resolveConfiguredAgentResources, resolveNewAgentResources } from "./resources.js";
export type { AgentRegistryConfig, AgentRegistryEntry, ConfiguredAgent } from "./types.js";
export type { AgentConfigurationRuntime, AgentRegistrationInput,AgentResourceOptions, AgentResourcePaths } from "./types.js";
export { resolveConfiguredAgentWorkspace } from "./workspace.js";
