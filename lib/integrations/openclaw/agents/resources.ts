/** Resolves SDK-owned resource paths and provisions them without owning setup policy or Claw Foundry files. */

import fs from "node:fs/promises";
import path from "node:path";

import { AGENT_DIRECTORY, AGENTS_DIRECTORY, NEW_AGENT_ID_PATTERN, SESSIONS_DIRECTORY, WORKSPACE_DIRECTORY } from "./const.js";
import { findConfiguredAgent } from "./registry.js";
import { projectAgentConfiguration } from "./sdk-config.js";
import type { AgentRegistryConfig, AgentResourceOptions, AgentResourcePaths } from "./types.js";
import { resolveConfiguredAgentWorkspace } from "./workspace.js";

/** Resolve the paths explicitly assigned to a new agent; performs no filesystem mutation.
 * @param agentId - Normalized new identity, excluding path separators and traversal.
 * @param options - Optional explicit state root; otherwise the SDK resolves current home/environment.
 */
export async function resolveNewAgentResources(agentId: string, options: AgentResourceOptions = {}): Promise<AgentResourcePaths> {
  if (!NEW_AGENT_ID_PATTERN.test(agentId)) throw new Error(`Invalid new agent identifier: ${agentId}`);
  const { resolveStateDir } = await import("openclaw/plugin-sdk/state-paths");
  const root = options.openClawHome ?? resolveStateDir();
  const agentRoot = path.join(root, AGENTS_DIRECTORY, agentId);

  return { agentId, workspacePath: path.join(agentRoot, WORKSPACE_DIRECTORY),
    agentDirectory: path.join(agentRoot, AGENT_DIRECTORY), sessionsDirectory: path.join(agentRoot, SESSIONS_DIRECTORY) };
}

/** Resolve an existing target through SDK rules, including custom workspace and agent directory.
 * @param config - Fresh configuration, including the selected agent.
 * @param agentId - Configured identity; runtime paths do not apply new-name membership rules.
 * @param workspacePath - Optional explicit workspace-only override selected by the operator.
 */
export async function resolveConfiguredAgentResources(config: AgentRegistryConfig, agentId: string, workspacePath?: string): Promise<AgentResourcePaths> {
  if (!findConfiguredAgent(config, agentId)) throw new Error(`Agent "${agentId}" is not configured.`);
  const { resolveAgentDir } = await import("openclaw/plugin-sdk/agent-scope-runtime");
  const agentDirectory = resolveAgentDir(projectAgentConfiguration(config), agentId);
  const { resolveStateDir } = await import("openclaw/plugin-sdk/state-paths");
  const { normalizeAgentId } = await import("openclaw/plugin-sdk/routing");

  return { agentId, workspacePath: workspacePath ?? await resolveConfiguredAgentWorkspace(config, agentId),
    agentDirectory, sessionsDirectory: path.join(resolveStateDir(), AGENTS_DIRECTORY, normalizeAgentId(agentId), SESSIONS_DIRECTORY) };
}

/** Create missing SDK directories idempotently; any failure retains already-created resources.
 * @param resources - Explicit resources resolved for the selected target.
 */
export async function provisionAgentResources(resources: AgentResourcePaths): Promise<void> {
  await fs.mkdir(resources.workspacePath, { recursive: true });
  await fs.mkdir(resources.agentDirectory, { recursive: true });
  await fs.mkdir(resources.sessionsDirectory, { recursive: true });
}

/** Resume an explicit directory plan stored by registration; implicit SDK resources remain host-managed.
 * @param config - Fresh active SDK configuration.
 * @param agentId - Existing agent selected for setup recovery.
 * @param workspacePath - Explicit Claw Foundry workspace target retained by the application.
 */
export async function provisionConfiguredAgentResources(config: AgentRegistryConfig, agentId: string, workspacePath: string): Promise<void> {
  const agent = findConfiguredAgent(config, agentId);

  if (!agent) throw new Error(`Agent "${agentId}" is not configured.`);
  if (!agent.agentDir) return;
  await provisionAgentResources(await resolveConfiguredAgentResources(config, agentId, workspacePath));
}
