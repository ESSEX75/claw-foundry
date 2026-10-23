/**
 * onboard — Conversational Claw Foundry onboarding.
 *
 * Returns step-by-step guidance. Call this before setup.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { getOnboardingContext } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { toolInputParameters } from "../../validation/index.js";
import { ONBOARD_TOOL_NAME } from "./const.js";

/** Validates onboard arguments before context resolution or effects. */
const onboardInput = z.strictObject({
  mode: z.enum(["first-run", "reconfigure"]).describe("Auto-detected if omitted.").optional(),
});

/** Create the conversational onboarding adapter.
 * @param ctx - Current plugin configuration used for onboarding detection.
 */
export function createOnboardTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: ONBOARD_TOOL_NAME,
    label: "Onboard",
    description: "Start Claw Foundry onboarding workflow. Returns step-by-step QA-style guidance. Call this first, then setup with collected answers.",
    parameters: toolInputParameters(onboardInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = onboardInput.parse(rawParams);
      const requestedMode = params.mode;

      const { mode, configured, instructions } = await getOnboardingContext(toolCtx.workspaceDir, ctx.pluginConfig, requestedMode);

      return jsonResult({
        success: true, mode, configured, instructions,
        nextSteps: ["Follow instructions above", "Call setup with collected answers", mode === "first-run" ? "Register a project afterward" : null].filter(Boolean),
      });
    },
  });
}
