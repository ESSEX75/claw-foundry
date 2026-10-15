/**
 * task_create — Create a new task (issue) in the project's issue tracker.
 *
 * Durably creates an issue through the application creation saga with the specified title and description in the
 * configured initial workflow state.
 *
 * Use this when:
 * - You want to create work items from chat
 * - A sub-agent finds a bug and needs to file a follow-up issue
 * - Breaking down an epic into smaller tasks
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { createManagedTaskIssue, EYES_EMOJI, resolveProject, resolveProvider } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import type { NotifyBindingRef } from "../../../domain/index.js";
import { loadInstanceName } from "../../../instance.js";
import { loadConfig } from "../../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../../context/index.js";
import { channelIdInput, requiredTextInput, toolInputParameters } from "../../validation/index.js";
import { TASK_CREATE_TOOL_NAME } from "./const.js";

/** Validates task-create arguments before context resolution or effects. */
const taskCreateInput = z.strictObject({
  channelId: channelIdInput,
  title: requiredTextInput.describe("Short, descriptive issue title (e.g., 'Fix login timeout bug')"),
  idempotencyKey: requiredTextInput.describe("Stable caller-generated request ID. Reuse it only when retrying this exact creation request."),
  description: z.string().describe("Full issue body in markdown. Use for detailed context, acceptance criteria, reproduction " +
    "steps, links. Supports GitHub-flavored markdown.").optional(),
  assignees: z.array(requiredTextInput).describe("GitHub/GitLab usernames to assign (optional)").optional(),
});

/** Create the task create SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskCreateTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: TASK_CREATE_TOOL_NAME,
    label: "Task Create",
    description:
      "Create a new task (issue) in the project's issue tracker. Use this to file bugs, features, or tasks from chat. " +
      "The issue remains in the configured initial state until task_start is called, unless that initial state is already a queue.",
    parameters: toolInputParameters(taskCreateInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskCreateInput.parse(rawParams);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const title = params.title;
      const description = params.description ?? "";
      const assignees = params.assignees;
      const idempotencyKey = params.idempotencyKey;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      const { project, endpoint } = await resolveProject(workspaceDir, channelId);
      const { provider, type: providerType } = await resolveProvider(workspaceDir, project, ctx.runCommand);
      const resolvedConfig = await loadConfig(workspaceDir, project.slug);
      const instanceName = await loadInstanceName(workspaceDir, resolvedConfig.instanceName);
      const notifyTarget: NotifyBindingRef = { channel: endpoint.channel, name: endpoint.name };

      const created = await createManagedTaskIssue({
        workspaceDir,
        project,
        providerType,
        provider,
        workflow: resolvedConfig.workflow,
        roles: Object.keys(resolvedConfig.roles),
        title,
        description,
        assignees,
        notifyTarget,
        owner: instanceName,
        idempotencyKey,
        requestedBy: toolCtx.agentId ?? "agent",
      });

      if (created.success && created.issue) provider.reactToIssue(created.issue.iid, EYES_EMOJI).catch(() => {});

      const hasBody = description && description.trim().length > 0;
      let announcement = created.issue
        ? `${created.success ? "📋 Created" : "⏳ Creation pending for"} #${created.issue.iid}: "${title}" (${created.label})`
        : `⏳ Creation pending: "${title}" (${created.label})`;

      if (hasBody) announcement += "\nWith detailed description.";
      if (created.issue) announcement += `\n🔗 [Issue #${created.issue.iid}](${created.issue.web_url})`;
      announcement += created.announcementSuffix;

      return jsonResult({
        success: created.success,
        status: created.status,
        operationId: created.operationId,
        idempotencyKey: created.idempotencyKey,
        issue: created.issue ? {
          id: created.issue.iid,
          title: created.issue.title,
          body: hasBody ? description : null,
          url: created.issue.web_url,
          label: created.label,
          workflowState: created.workflowState,
          role: created.role,
        } : undefined,
        project: project.name,
        provider: providerType,
        completedSteps: created.completedSteps,
        pendingSteps: created.pendingSteps,
        integrity: created.integrity,
        error: created.error,
        recovery: created.recovery,
        auditCorrelationId: created.auditCorrelationId,
        announcement,
      });
    },
  });
}
