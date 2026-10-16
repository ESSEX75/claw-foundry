/** Adapts terminal setup options to the shared application command. */

import type { Command } from "commander";

import {
  isScopeApprovalRejectedError,
  isScopeApprovalRequiredError,
  runSetup,
  type SetupOpts,
} from "../../application/index.js";
import { collectModelAssignment, getBuiltInModelOptions, parseModelOverrides } from "../options/models.js";
import {
  normalizeChannelBinding,
  normalizeProjectExecution,
} from "../options/setup-options.js";
import type { SetupCliOptions } from "../options/types.js";
import { collectInteractiveSetupDetails } from "../prompts/channel-prompts.js";
import { printSelectedSetupTarget, printSetupResult } from "../prompts/setup-output.js";
import { resolveSetupCliOptions } from "../prompts/target-prompts.js";

/** Register terminal options that dispatch the shared setup command.
 * @param parent - Parent DevClaw command group.
 * @param ctx - Setup runtime and scope command transport.
 */
export function registerSetupCommand(parent: Command, ctx: Pick<SetupOpts, "runtime" | "runCommand">): void {
  const setupCmd = parent
    .command("setup")
    .description("Set up DevClaw: create agent, configure models, write workspace files")
    .option("--new-agent <name>", "Create a new agent with this name")
    .option("--agent <id>", "Use an existing agent by ID")
    .option("--workspace <path>", "Direct workspace path")
    .option("--channel-binding <channel>", "Channel binding for a new agent: telegram, whatsapp, or none")
    .option("--channel-account-id <id>", "Explicit channel account id for the binding")
    .option("--channel-peer-id <id>", "Exact group/topic peer id for the binding, e.g. -100123:topic:331")
    .option("--project-execution <mode>", "Project execution mode: parallel or sequential")
    .option("--model <role.level=model>", "Set a configured model assignment (repeatable)", collectModelAssignment, [])
    .option("--dry-run", "Print the setup plan without writing configuration or workspace files")
    .option("--eject-defaults", "Write missing packaged defaults into the workspace")
    .option("--reset-defaults", "Reset packaged defaults with backups")
    .option("--refresh-instructions", "Refresh system instructions with backups");

  for (const option of getBuiltInModelOptions()) {
    setupCmd.option(`${option.flag} <model>`, `${option.role.toUpperCase()} ${option.level} model override`, collectModelAssignment, []);
  }

  setupCmd.action(async (rawOpts: SetupCliOptions) => {
    try {
      const opts = await collectInteractiveSetupDetails(
        await resolveSetupCliOptions(rawOpts, ctx.runtime),
        ctx.runtime,
      );

      printSelectedSetupTarget(opts, ctx.runtime);

      const models = parseModelOverrides(opts);

      const result = await runSetup({
        runtime: ctx.runtime,
        runCommand: ctx.runCommand,
        newAgentName: opts.newAgent,
        channelBinding: normalizeChannelBinding(opts.channelBinding),
        channelAccountId: opts.channelAccountId,
        channelPeerId: opts.channelPeerId,
        agentId: opts.agent,
        workspacePath: opts.workspace,
        models,
        ejectDefaults: opts.ejectDefaults === true,
        resetDefaults: opts.resetDefaults === true,
        refreshInstructions: opts.refreshInstructions === true,
        projectExecution: normalizeProjectExecution(opts.projectExecution),
        dryRun: opts.dryRun === true,
      });

      printSetupResult(result);
    } catch (err) {
      if (isScopeApprovalRequiredError(err)) {
        console.error("OpenClaw scope approval required.");
        console.error(`Missing scopes: ${err.missingScopes.join(", ")}`);
        console.error(`Approval request: ${err.requestId}`);
        console.error("Approve this request in OpenClaw UI or CLI, then rerun: openclaw devclaw setup");
        process.exitCode = 1;

        return;
      }

      if (isScopeApprovalRejectedError(err)) {
        console.error(err.message);
        process.exitCode = 1;

        return;
      }

      throw err;
    }
  });
}
