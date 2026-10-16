/** Resolves setup targets, route validation, and model changes without side effects. */

import { findConfiguredAgent } from "../../integrations/index.js";
import { getAgentId, getAgentWorkspacePath, resolveWorkspacePath } from "./agents/index.js";
import { SETUP_OPERATION, UNKNOWN_AGENT_ID } from "./const.js";
import { resolveSetupModels } from "./model-configuration.js";
import { planChannelBinding } from "./routing/index.js";
import type { SetupOpts, SetupResult } from "./types.js";

/** Resolve a validated setup plan; performs reads only and never invokes command transport.
 * @param opts - Explicit target and requested operation.
 */
export async function planSetup(opts: Omit<SetupOpts, "runCommand">): Promise<SetupResult> {
  const fileOperations = [opts.ejectDefaults, opts.resetDefaults, opts.refreshInstructions].filter(Boolean).length;

  if (fileOperations > 1) throw new Error("Choose only one defaults or instruction operation.");
  if (opts.newAgentName && (opts.agentId || opts.workspacePath)) throw new Error("newAgentName cannot be combined with agentId or workspacePath.");
  if (fileOperations && (opts.newAgentName || opts.channelBinding || opts.models || opts.projectExecution)) {
    throw new Error("File operations cannot be combined with agent creation, binding, models, or project execution changes.");
  }

  const agentCreated = Boolean(opts.newAgentName);
  const agentId = opts.newAgentName ? getAgentId(opts.newAgentName) : opts.agentId ?? UNKNOWN_AGENT_ID;
  const workspacePath = opts.newAgentName ? getAgentWorkspacePath(agentId)
    : opts.workspacePath ?? (opts.agentId ? await resolveWorkspacePath(opts.runtime, opts.agentId) : undefined);

  if (!workspacePath) throw new Error("Setup requires either newAgentName, agentId, or workspacePath");
  const current = opts.runtime.config.current();
  const config = { ...current, agents: { ...current.agents,
    entries: current.agents?.entries ? { ...current.agents.entries } : undefined,
    list: current.agents?.list ? [...current.agents.list] : undefined } };

  if (agentCreated) {
    if (findConfiguredAgent(config, agentId)) throw new Error(`Agent "${agentId}" already exists in openclaw.json.`);
    if (config.agents.entries !== undefined) config.agents.entries[agentId] = { workspace: workspacePath };
    else {
      config.agents.list ??= [];
      config.agents.list.push({ id: agentId, workspace: workspacePath });
    }
  } else if (opts.agentId && !findConfiguredAgent(config, opts.agentId)) {
    throw new Error(`Agent "${agentId}" does not exist.`);
  }

  if (opts.channelBinding) {
    if (!opts.agentId && !opts.newAgentName) throw new Error("Channel binding requires an agent target.");
    if (!opts.channelAccountId?.trim()) throw new Error("channelAccountId is required when configuring a channel binding.");
    if (!opts.channelPeerId?.trim()) throw new Error("channelPeerId is required when configuring a channel binding.");
    planChannelBinding(config, opts.channelBinding, agentId, opts.channelAccountId, opts.channelPeerId);
  } else if (opts.channelAccountId || opts.channelPeerId) {
    throw new Error("Account and peer require channelBinding.");
  }

  // File recovery must remain available even when the existing workflow is invalid.
  const models = fileOperations ? {} : await resolveSetupModels(workspacePath, opts.models);
  const plannedChanges = fileOperations
    ? [opts.resetDefaults ? "Reset packaged defaults with backups" : opts.refreshInstructions ? "Refresh system instructions with backups" : "Create missing packaged defaults"]
    : [
      ...(agentCreated ? [`Create OpenClaw agent "${agentId}"`] : []),
      ...(opts.agentId || agentCreated ? [`Configure DevClaw tool isolation for "${agentId}" and existing project owners`] : ["Configure DevClaw plugin defaults"]),
      ...(opts.channelBinding ? [`Create exact binding ${opts.channelBinding}/${opts.channelAccountId}/${opts.channelPeerId}`] : []),
      `Create missing workspace files in ${workspacePath}`,
      ...(opts.models ? ["Write explicit model overrides; preserve other configuration"] : []),
    ];
  const result: SetupResult = {
    operation: opts.ejectDefaults ? SETUP_OPERATION.EJECT : opts.resetDefaults ? SETUP_OPERATION.RESET
      : opts.refreshInstructions ? SETUP_OPERATION.REFRESH : SETUP_OPERATION.CONFIGURE,
    agentId, agentCreated, workspacePath, models, filesWritten: [], warnings: [],
    channelBinding: opts.channelBinding ?? null, channelAccountId: opts.channelAccountId,
    channelPeerId: opts.channelPeerId, defaultsEjected: opts.ejectDefaults === true,
    dryRun: opts.dryRun === true, plannedChanges,
  };

  return result;
}
