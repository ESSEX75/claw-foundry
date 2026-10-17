/** Applies validated setup plans shared by CLI and tools. */

import { provisionAgentResources, provisionConfiguredAgentResources, registerAgentConfiguration, resolveNewAgentResources } from "../../integrations/index.js";
import { initializeWorkspaceFiles, refreshSystemInstructionFiles, resetDefaults, scaffoldWorkspace, writeWorkspaceModels } from "../../state/index.js";
import { CONFIG_RELOAD_MODE, SETUP_APPLY_STEP, SETUP_OPERATION, SETUP_RECOVERY_ACTION } from "./const.js";
import { SetupApplyError } from "./errors.js";
import { ensureRequiredOpenClawScopes } from "./permissions/index.js";
import { writePluginConfig } from "./plugin-config.js";
import { ensureChannelBinding } from "./routing/index.js";
import { planSetup } from "./setup-plan.js";
import type { SetupOpts, SetupRecovery, SetupResult } from "./types.js";

/** Validate before effects and preserve existing files unless replacement was explicitly requested.
 * @param opts - Target, overrides, operation, preview selection, and runtime capabilities.
 */
export async function runSetup(opts: SetupOpts): Promise<SetupResult> {
  const result = await planSetup(opts);

  if (opts.dryRun) return result;
  const { agentId, workspacePath } = result;

  if (result.operation !== SETUP_OPERATION.CONFIGURE) {
    const written = opts.resetDefaults ? await resetDefaults(workspacePath)
      : opts.refreshInstructions ? await refreshSystemInstructionFiles(workspacePath)
      : await initializeWorkspaceFiles(workspacePath);

    return { ...result, filesWritten: written.written };
  }

  result.scopePreflight = await ensureRequiredOpenClawScopes(opts.runCommand);
  result.agentCreated = false;
  let step: SetupRecovery["step"] = SETUP_APPLY_STEP.AGENT_REGISTRATION;

  try {
    if (opts.newAgentName) {
      const resources = await resolveNewAgentResources(agentId);

      if (resources.workspacePath !== workspacePath) throw new Error("SDK agent resource root changed after setup planning.");
      await registerAgentConfiguration({ runtime: opts.runtime, name: opts.newAgentName, agentId, resources,
        afterWrite: { mode: CONFIG_RELOAD_MODE.NONE, reason: "DevClaw setup continues with a second config write that owns reload handling." } });
      result.agentCreated = true;
      step = SETUP_APPLY_STEP.RESOURCES;
      await provisionAgentResources(resources);
    } else if (opts.agentId) {
      step = SETUP_APPLY_STEP.RESOURCES;
      await provisionConfiguredAgentResources(opts.runtime.config.current(), agentId, workspacePath);
    }

    step = SETUP_APPLY_STEP.BINDING;
    if (opts.channelBinding && opts.channelAccountId && opts.channelPeerId) {
      await ensureChannelBinding(opts.runtime, opts.channelBinding, agentId, opts.channelAccountId, opts.channelPeerId);
    }

    step = SETUP_APPLY_STEP.PLUGIN;
    await writePluginConfig(opts.runtime, opts.agentId || result.agentCreated ? agentId : undefined, opts.projectExecution);
    step = SETUP_APPLY_STEP.SCAFFOLD;
    result.filesWritten = (await scaffoldWorkspace(workspacePath, opts.runtime.config.current().agents?.defaults?.workspace)).written;
    if (opts.models) {
      step = SETUP_APPLY_STEP.MODELS;
      result.filesWritten.push(...(await writeWorkspaceModels(workspacePath, opts.models)).written);
    }
  } catch (cause) {
    const recovery: SetupRecovery = { step, reason: cause instanceof Error ? cause.message : String(cause),
      action: opts.newAgentName && !result.agentCreated ? SETUP_RECOVERY_ACTION.INSPECT_REGISTRATION : SETUP_RECOVERY_ACTION.RESUME_TARGET,
      agentId: opts.agentId || opts.newAgentName ? agentId : undefined, workspacePath };

    throw new SetupApplyError({ ...result, recovery }, cause);
  }

  return { ...result, filesWritten: [...new Set(result.filesWritten)] };
}
