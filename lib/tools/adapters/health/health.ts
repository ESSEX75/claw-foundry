/** Validates manual health scope and formats application-owned worker diagnostics. */
import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { inspectWorkerHealth } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { requireWorkspaceDir } from "../../context/index.js";
import { requiredTextInput, toolInputParameters } from "../../validation/index.js";
import { HEALTH_TOOL_NAME } from "./const.js";

/** Validates health arguments before context resolution or effects. */
const healthInput = z.strictObject({
  projectSlug: requiredTextInput.describe("Canonical project slug to scan. Omit for all projects.").optional(),
  fix: z.boolean().describe("Apply fixes for detected issues. Default: false (read-only).").optional(),
});

/** Create manual health inspection with the same resolved policy as the heartbeat.
 * @param ctx - Command transport for provider observations and worker remediation.
 */
export function createHealthTool(ctx: Pick<PluginContext, "runCommand">): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: HEALTH_TOOL_NAME,
    label: "Health",
    description: "Scan worker health across projects, including retained slots of disabled or removed roles. "
      + "Pass fix=true to apply safe remedies. Omit projectSlug to scan all registered projects.",
    parameters: toolInputParameters(healthInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = healthInput.parse(rawParams);
      const result = await inspectWorkerHealth({ workspaceDir: requireWorkspaceDir(toolCtx), projectSlug: params.projectSlug,
        fix: params.fix, runCommand: ctx.runCommand });

      return jsonResult({ ...result, issues: result.issues.map(finding => ({ ...finding, project: finding.issue.project, role: finding.issue.role })) });
    },
  });
}
