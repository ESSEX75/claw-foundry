/** Validates research requests and formats application-owned creation and delivery progress. */
import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { researchTask, type ResearchTaskInput } from "../../../../application/index.js";
import { TASK_COMPLEXITY } from "../../../../roles/index.js";
import { requireWorkspaceDir } from "../../../context/index.js";
import { channelIdInput, requiredTextInput, toolInputParameters } from "../../../validation/index.js";
import { RESEARCH_TASK_TOOL_NAME } from "./const.js";
import { renderDispatchAnnouncement } from "./dispatch-render.js";
import { renderCreationResult } from "./result-render.js";

/** Validates research-task arguments before context resolution or effects. */
const researchTaskInput = z.strictObject({
  channelId: channelIdInput,
  idempotencyKey: requiredTextInput.describe("Stable caller request ID; reuse it to resume the same research across tool calls."),
  workflowState: requiredTextInput.describe("Explicit architect queue state key when more than one is configured.").optional(),
  title: requiredTextInput.describe("Research title (e.g., 'Research: Session persistence strategy')"),
  description: requiredTextInput.describe("Detailed background context: what exists today, why this needs investigation, constraints, " +
    "relevant code paths, prior decisions. Must be detailed enough for the architect to produce development-ready findings."),
  focusAreas: z.array(requiredTextInput).describe("Specific areas to investigate (e.g., ['performance', 'scalability', 'simplicity'])").optional(),
  complexity: z.enum(Object.values(TASK_COMPLEXITY)).describe("Selects level: simple → lowest rank, medium → default, complex → highest rank. When omitted, " +
    "analyzes task text.").optional(),
  dryRun: z.boolean().describe("Preview without executing. Defaults to false.").optional(),
});

/** Create the research adapter with explicit complexity validation before task effects.
 * @param ctx - Command transport and optional notification runtime used by the application; gateway dispatch also works through CLI.
 */
export function createResearchTaskTool(ctx: Pick<ResearchTaskInput, "runCommand" | "runtime" | "pluginConfig">): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: RESEARCH_TASK_TOOL_NAME,
    label: "Research Task",
    description: `Spawn an architect to research a design/architecture problem. Creates an issue in the configured architect queue and dispatches an architect worker.

IMPORTANT: Provide a detailed description with enough background context for the architect
to produce actionable, development-ready findings. Include: current state, constraints,
requirements, relevant code paths, and any prior decisions. The output should be detailed
enough for a developer to start implementation immediately.

The architect will:
1. Research the problem systematically (codebase, docs, web)
2. Post findings as comments via task_comment
3. Create implementation tasks via task_create in the configured initial state
4. Call work_finish with the configured completion result and findings summary

Example arguments:
\`\`\`json
{
  "channelId": "-1003844794417",
  "idempotencyKey": "session-persistence-research",
  "title": "Research: Session persistence strategy",
  "description": "Sessions are lost on restart. Current implementation uses an in-memory Map. Compare persistent storage with a 50ms read latency limit.",
  "focusAreas": ["SQLite vs file-based", "migration path", "cache invalidation"],
  "complexity": "complex"
}
\`\`\``,
    parameters: toolInputParameters(researchTaskInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = researchTaskInput.parse(rawParams);
      const result = await researchTask({ ...params, workspaceDir: requireWorkspaceDir(toolCtx),
        agentId: toolCtx.agentId, sessionKey: toolCtx.sessionKey, pluginConfig: ctx.pluginConfig,
        runtime: ctx.runtime, runCommand: ctx.runCommand });

      return jsonResult({ ...result,
        creation: result.creation ? renderCreationResult(result.creation) : undefined,
        issue: result.issue ? { id: result.issue.iid, title: result.issue.title, url: result.issue.web_url, label: result.label }
          : params.dryRun ? { title: params.title, label: result.label } : undefined,
        research: { level: result.level, model: result.model, status: result.status,
          deliveryStatus: result.deliveryStatus, deliveryId: result.deliveryId,
          sessionAction: result.dispatch?.sessionAction, reason: result.reason,
          sessionKey: result.dispatch?.sessionKey ?? result.existingWorker?.sessionKey },
        announcement: result.dispatch ? renderDispatchAnnouncement(result.dispatch)
          : `Research ${result.status}${result.issue ? ` #${result.issue.iid}` : ""}${result.reason ? `: ${result.reason}` : ""}`,
      });
    },
  });
}
