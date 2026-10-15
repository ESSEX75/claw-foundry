/**
 * research_task — Start a research ticket in "To Research" state and dispatch the architect.
 *
 * The architect picks up the issue, researches, posts findings, and creates
 * implementation tasks via task_create. Then calls work_finish(result="done")
 * which closes the research issue (findings preserved in comments).
 *
 * Flow:
 *   research_task() → issue created in "To Research" → architect dispatched
 *   → architect researches, posts findings with task_comment
 *   → architect creates implementation tasks with task_create (queued in To Do)
 *   → architect calls work_finish(result="done") → "Researching" → "Done" (issue closed)
 *   → heartbeat dispatches queued implementation tasks
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { createManagedTaskIssue, dispatchTask, resolveProject, resolveProvider } from "../../application/index.js";
import { log as auditLog } from "../../audit.js";
import type { PluginContext } from "../../context.js";
import { countActiveSlots, findStateKeyByLabel, getActiveLabel } from "../../domain/index.js";
import { loadInstanceName } from "../../instance.js";
import { resolveModelForLevel, selectLevel, TASK_COMPLEXITY } from "../../roles/index.js";
import { loadConfig } from "../../state/index.js";
import { getRoleWorker } from "../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../helpers.js";
import { requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Queue label for research tasks. */
const TO_RESEARCH_LABEL = "To Research";

/** Validates research-task arguments before context resolution or effects. */
const researchTaskInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now " +
    "(e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from."),
  title: requiredTextInput.describe("Research title (e.g., 'Research: Session persistence strategy')"),
  description: requiredTextInput.describe("Detailed background context: what exists today, why this needs investigation, constraints, " +
    "relevant code paths, prior decisions. Must be detailed enough for the architect to produce development-ready findings."),
  focusAreas: z.array(requiredTextInput).describe("Specific areas to investigate (e.g., ['performance', 'scalability', 'simplicity'])").optional(),
  complexity: z.enum(Object.values(TASK_COMPLEXITY)).describe("Selects level: simple → lowest rank, medium → default, complex → highest rank. When omitted, " +
    "analyzes task text.").optional(),
  dryRun: z.boolean().describe("Preview without executing. Defaults to false.").optional(),
});

/** Create the research adapter with explicit complexity validation before task effects.
 * @param ctx - Plugin runtime dependencies used for project resolution and dispatch.
 */
export function createResearchTaskTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "research_task",
    label: "Research Task",
    description: `Spawn an architect to research a design/architecture problem. Creates a "To Research" issue and dispatches an architect worker.

IMPORTANT: Provide a detailed description with enough background context for the architect
to produce actionable, development-ready findings. Include: current state, constraints,
requirements, relevant code paths, and any prior decisions. The output should be detailed
enough for a developer to start implementation immediately.

The architect will:
1. Research the problem systematically (codebase, docs, web)
2. Post findings as comments via task_comment
3. Create implementation tasks via task_create (queued for heartbeat dispatch)
4. Call work_finish(result="done", summary="<recommendation + task numbers>") — closes the research issue

Example:
  research_task({
    title: "Research: Session persistence strategy",
    description: "Sessions are lost on restart. Current impl uses in-memory Map in session-store.ts. " +
      "Constraints: must work with SQLite (already a dep), max 50ms latency on read. Prior discussion in #42 ruled out Redis.",
    focusAreas: ["SQLite vs file-based", "migration path", "cache invalidation"],
    complexity: "complex"
  })`,
    parameters: toolInputParameters(researchTaskInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = researchTaskInput.parse(rawParams);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const title = params.title;
      const description = params.description ?? "";
      const focusAreas = params.focusAreas ?? [];
      const complexity = params.complexity;

      const dryRun = params.dryRun ?? false;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      const { project, endpoint } = await resolveProject(workspaceDir, channelId);
      const { provider, type: providerType } = await resolveProvider(workspaceDir, project, ctx.runCommand);
      const pluginConfig = ctx.pluginConfig;
      const role = "architect";
      const resolvedConfig = await loadConfig(workspaceDir, project.slug);
      const resolvedRole = resolvedConfig.roles[role];

      if (!resolvedRole?.enabled) {
        throw new Error(`Role "${role}" is not configured or is disabled.`);
      }

      // Build issue body with rich context for the architect to start from
      const bodyParts = ["## Background", "", description];

      if (focusAreas.length > 0) {
        bodyParts.push("", "## Focus Areas", ...focusAreas.map((a) => `- ${a}`));
      }

      const issueBody = bodyParts.join("\n");

      await auditLog(workspaceDir, "research_task", {
        project: project.name, title, complexity, focusAreas, dryRun,
      });

      const level = selectLevel(title, description, role, resolvedRole, complexity).level;
      const model = resolveModelForLevel(level, resolvedRole);

      if (dryRun) {
        return jsonResult({
          success: true,
          dryRun: true,
          issue: { title, label: TO_RESEARCH_LABEL },
          research: { level, model, status: "dry_run" },
          announcement: `\u{1f4d0} [DRY RUN] Would create research ticket and dispatch ${role} (${level}) for: ${title}`,
        });
      }

      const workflowState = findStateKeyByLabel(resolvedConfig.workflow, TO_RESEARCH_LABEL);

      if (!workflowState) throw new Error(`No workflow state found for label "${TO_RESEARCH_LABEL}".`);
      const instanceName = await loadInstanceName(workspaceDir, resolvedConfig.instanceName);
      const creation = await createManagedTaskIssue({
        workspaceDir,
        project,
        providerType,
        provider,
        workflow: resolvedConfig.workflow,
        roles: Object.keys(resolvedConfig.roles),
        title,
        description: issueBody,
        assignees: [],
        workflowState,
        assignedRole: role,
        assignedLevel: level,
        owner: instanceName,
        notifyTarget: { channel: endpoint.channel, name: endpoint.name },
        idempotencyKey: `research-task:${_id}`,
        requestedBy: "research_task",
      });

      if (!creation.success || !creation.issue) {
        return jsonResult({
          success: false,
          creation,
          research: { level, model, status: "creation_pending" },
          announcement: `Research ticket creation is ${creation.status}; it is unavailable to workers until reconciliation completes.`,
        });
      }

      const issue = creation.issue;

      provider.reactToIssue(issue.iid, "eyes").catch(() => {});

      // Check worker availability across all levels
      const roleWorker = getRoleWorker(project, role);

      if (countActiveSlots(roleWorker) > 0) {
        // Architect is busy — issue created in queue, heartbeat will pick it up when free
        // Find any active slot's issueId for the message
        const activeIssueId = Object.values(roleWorker.levels)
          .flatMap((slots) => slots ?? [])
          .find((s) => s.active)?.issueId;

        return jsonResult({
          success: true,
          issue: { id: issue.iid, title: issue.title, url: issue.web_url, label: TO_RESEARCH_LABEL },
          research: {
            level,
            status: "queued",
            reason: `${role.toUpperCase()} already active on #${activeIssueId}. Research ticket queued — architect will pick it up when current work completes.`,
          },
          announcement: `\u{1f4d0} Created research ticket #${issue.iid}: ${title} (architect busy — queued)\n\u{1f517} [Issue #${issue.iid}](${issue.web_url})`,
        });
      }

      // Dispatch architect via standard dispatchTask — same pipeline as every other role.
      // fromLabel: "To Research" (queue), toLabel: "Researching" (active)
      const toLabel = getActiveLabel(resolvedConfig.workflow, role);
      const dr = await dispatchTask({
        workspaceDir,
        agentId: toolCtx.agentId,
        project,
        issueId: issue.iid,
        issueTitle: issue.title,
        issueDescription: issueBody,
        issueUrl: issue.web_url,
        role,
        level,
        fromLabel: TO_RESEARCH_LABEL,
        toLabel,
        provider,
        pluginConfig,
        sessionKey: toolCtx.sessionKey,
        runtime: ctx.runtime,
        runCommand: ctx.runCommand,
      });

      return jsonResult({
        success: true,
        issue: { id: issue.iid, title: issue.title, url: issue.web_url, label: toLabel },
        research: {
          sessionKey: dr.sessionKey,
          level: dr.level,
          model: dr.model,
          sessionAction: dr.sessionAction,
          status: "in_progress",
        },
        project: project.name,
        announcement: dr.announcement,
      });
    },
  });
}
