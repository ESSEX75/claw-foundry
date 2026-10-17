/**
 * setup — Agent-driven DevClaw setup.
 *
 * Creates agent, configures model levels, writes workspace files.
 * Thin wrapper around application setup orchestration.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import {
  isScopeApprovalRejectedError,
  isScopeApprovalRequiredError,
  runSetup,
  SETUP_NOTIFICATION_CHANNELS,
  SetupApplyError,
  type SetupOpts,
} from "../../application/index.js";
import { EXECUTION_MODE } from "../../domain/index.js";
import { requiredTextInput, toolInputParameters } from "../validation/index.js";
import { SETUP_TOOL_NAME } from "./const.js";

/** Validates setup arguments before context resolution or effects. */
const setupInput = z.strictObject({
  newAgentName: requiredTextInput.describe("Create a new agent. Omit to configure current workspace.").optional(),
  channelBinding: z.enum(SETUP_NOTIFICATION_CHANNELS).describe("Channel to bind to the selected or newly-created agent.").optional(),
  channelAccountId: requiredTextInput.describe("Explicit channel account id required when channelBinding is set, e.g. Telegram account 'dev'.").optional(),
  channelPeerId: requiredTextInput.describe("Exact group/chat/topic peer id required when channelBinding is set, e.g. '-1003911014709:topic:331'.").optional(),
  models: z.record(z.string(), z.record(z.string(), requiredTextInput)).describe("Model overrides keyed by configured role and level.").optional(),
  projectExecution: z.enum(Object.values(EXECUTION_MODE)).describe("Project execution mode. Default: parallel.").optional(),
  ejectDefaults: z.boolean().describe("Write all package defaults to workspace. Skips files that already exist.").optional(),
  resetDefaults: z.boolean().describe("Force-write all package defaults to workspace, overwriting existing files. Creates .bak backups.").optional(),
  refreshInstructions: z.boolean().describe("Refresh system instructions only, preserving .bak backups.").optional(),
  dryRun: z.boolean().describe("Return the setup plan without writing OpenClaw or workspace configuration.").optional(),
});

/** Create the setup adapter with validated tool inputs and application-owned effects.
 * @param ctx - Setup runtime and command transport.
 */
export function createSetupTool(ctx: Pick<SetupOpts, "runtime" | "runCommand">): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: SETUP_TOOL_NAME,
    label: "Setup",
    description:
      `Execute DevClaw setup. Creates AGENTS.md, HEARTBEAT.md, TOOLS.md, devclaw/projects.json, ` +
      `devclaw/prompts/, and model level config. Optionally creates a new agent with channel binding. ` +
      `Called after onboard collects configuration.`,
    parameters: toolInputParameters(setupInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const input = setupInput.parse(rawParams);
      let result: Awaited<ReturnType<typeof runSetup>>;
      const channelBindingInput = input.channelBinding;

      try {
        result = await runSetup({
          runtime: ctx.runtime,
          runCommand: ctx.runCommand,
          newAgentName: input.newAgentName,
          channelBinding: channelBindingInput ?? null,
          channelAccountId: input.channelAccountId,
          channelPeerId: input.channelPeerId,
          agentId: input.newAgentName ? undefined : toolCtx.agentId,
          workspacePath: input.newAgentName ? undefined : toolCtx.workspaceDir,
          models: input.models,
          projectExecution: input.projectExecution,
          dryRun: input.dryRun === true,
          ejectDefaults: input.ejectDefaults,
          resetDefaults: input.resetDefaults,
          refreshInstructions: input.refreshInstructions,
        });
      } catch (err) {
        if (isScopeApprovalRequiredError(err)) {
          return jsonResult({
            success: false,
            status: "PENDING_APPROVAL",
            requiredScopes: err.requiredScopes,
            missingScopes: err.missingScopes,
            requestId: err.requestId,
            summary:
              `OpenClaw approval is required before DevClaw setup can continue.\n` +
              `Approve request ${err.requestId} in OpenClaw UI or CLI, then call setup again.`,
          });
        }

        if (isScopeApprovalRejectedError(err)) {
          return jsonResult({
            success: false,
            status: err.status.toUpperCase(),
            requestId: err.requestId,
            summary: err.message,
          });
        }

        if (err instanceof SetupApplyError) return jsonResult({ success: false, ...err.result, summary: err.message });
        throw err;
      }

      if (result.operation !== "configure") {
        return jsonResult({ success: true, ...result, summary: result.dryRun
          ? `Setup dry-run: ${result.plannedChanges.join("; ")}`
          : `${result.operation}: ${result.filesWritten.length} files written` });
      }

      const scopePreflight = result.scopePreflight;
      const lines = [
        result.agentCreated
          ? `Agent "${result.agentId}" created`
          : `Configured "${result.agentId}"`,
        "",
      ];

      lines.push("Models:");
      for (const [role, levels] of Object.entries(result.models)) {
        for (const [level, model] of Object.entries(levels)) {
          lines.push(`  ${role}.${level}: ${model}`);
        }
      }

      lines.push("");

      lines.push("Files:", ...result.filesWritten.map((f) => `  ${f}`));

      if (result.dryRun) {
        return jsonResult({ success: true, ...result, summary: `Setup dry-run:\n${result.plannedChanges.map((change) => `  - ${change}`).join("\n")}` });
      }

      if (scopePreflight?.status === "approved") {
        lines.push("", "OpenClaw scopes: approved");
      }

      if (scopePreflight?.warning) {
        lines.push("", "OpenClaw scopes warning:", `  ${scopePreflight.warning}`);
      }

      if (result.warnings.length > 0)
        lines.push("", "Warnings:", ...result.warnings.map((w) => `  ${w}`));
      lines.push(
        "",
        "Done!",
        "",
        "Next steps are messages/actions, not shell menu choices:",
        "  - Restart the OpenClaw gateway so the new bot/chat binding becomes active.",
        "  - Add the bot to the selected Telegram/WhatsApp chat.",
        '  - In that group, send: "Register project <name> at <repo> with base branch <branch>".',
        "  - Create the first issue and ask DevClaw to pick it up.",
      );

      return jsonResult({
        success: true,
        ...result,
        summary: lines.join("\n"),
      });
    },
  });
}
