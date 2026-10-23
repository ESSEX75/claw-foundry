/** Renders setup targets and completed application plans or results for terminal users. */

import { SETUP_OPERATION, type SetupResult, type SetupRuntime } from "../../../application/index.js";
import { NO_CHANNEL_BINDING } from "./const.js";
import { formatAgentLabel, formatSelectedChannelBinding, getConfiguredAgents } from "./options.js";
import type { SetupCliOptions } from "./types.js";

/** Render the explicitly selected target without changing configuration.
 * @param opts - Selected terminal target and channel details.
 * @param runtime - Agent inventory used only to enrich terminal display.
 */
export function printSelectedSetupTarget(opts: SetupCliOptions, runtime: SetupRuntime): void {
  const agents = getConfiguredAgents(runtime);

  if (opts.agent) {
    const agent = agents.find((entry) => entry.id === opts.agent);

    console.log("\nSelected setup target:");
    console.log(`  Agent: ${agent ? formatAgentLabel(agent) : opts.agent}`);
    const workspace = opts.workspace ?? agent?.workspace;

    if (workspace) console.log(`  Workspace: ${workspace}`);
    console.log(`  Channel binding: ${formatSelectedChannelBinding(opts)}`);

    return;
  }

  if (opts.newAgent) {
    console.log("\nSelected setup target:");
    console.log(`  New agent: ${opts.newAgent}`);
    console.log(`  Channel binding: ${formatSelectedChannelBinding(opts)}`);

    return;
  }

  if (opts.workspace) {
    console.log("\nSelected setup target:");
    console.log(`  Workspace: ${opts.workspace}`);
  }
}

/** Render preview, file operation, or configuration results.
 * @param result - Completed application command outcome.
 */
export function printSetupResult(
  result: SetupResult,
): void {
  const scopePreflight = result.scopePreflight;

  if (result.dryRun) {
    console.log("Setup dry-run plan:");
    for (const change of result.plannedChanges) console.log(`  - ${change}`);

    return;
  }

  if (result.operation !== SETUP_OPERATION.CONFIGURE) {
    console.log(`${result.operation}: ${result.filesWritten.length} files written`);
    for (const file of result.filesWritten) console.log(`  ${file}`);

    return;
  }

  if (result.agentCreated) {
    console.log(`Agent "${result.agentId}" created`);
  }

  console.log("Setup target:");
  console.log(`  Agent: ${result.agentId}`);
  console.log(`  Workspace: ${result.workspacePath}`);
  console.log(`  Channel binding: ${result.channelBinding ?? NO_CHANNEL_BINDING}`);
  if (result.channelAccountId) console.log(`  Channel account: ${result.channelAccountId}`);
  if (result.channelPeerId) console.log(`  Channel peer: ${result.channelPeerId}`);

  console.log(`  Workspace defaults: ${result.defaultsEjected ? "ejected packaged defaults" : "safe defaults"}`);

  console.log("Models configured:");
  for (const [role, levels] of Object.entries(result.models)) {
    for (const [level, model] of Object.entries(levels)) {
      console.log(`  ${role}.${level}: ${model}`);
    }
  }

  console.log("Files written:");
  for (const file of result.filesWritten) {
    console.log(`  ${file}`);
  }

  if (scopePreflight?.status === "approved") {
    console.log("\nOpenClaw scopes: approved");
  }

  if (scopePreflight?.warning) {
    console.log("\nOpenClaw scopes warning:");
    console.log(`  ${scopePreflight.warning}`);
  }

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of result.warnings) {
      console.log(`  ${w}`);
    }
  }

  console.log("\nDone!");
  console.log("Next steps are messages/actions, not shell menu choices:");
  console.log("  - Restart the OpenClaw gateway so the new bot/chat binding becomes active.");
  console.log("  - Add the bot to the selected Telegram/WhatsApp chat.");
  console.log('  - In that group, send: "Register project <name> at <repo> with base branch <branch>".');
  console.log("  - Create the first issue and ask Claw Foundry to pick it up.");
}
