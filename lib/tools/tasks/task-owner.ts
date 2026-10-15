/**
 * task_owner — Claim issue(s) for this instance.
 *
 * Adds an `owner:{instanceName}` label to issues so this instance
 * owns them for queue scanning and dispatch. Supports claiming a
 * single issue or all unclaimed queued issues for a project.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { claimManagedTask, resolveProject, resolveProvider } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import {
  getAllQueueLabels,
  getOwnerLabel,
  ISSUE_INTEGRITY_STATUS,
} from "../../domain/index.js";
import { loadInstanceName } from "../../instance.js";
import { loadConfig } from "../../state/index.js";
import { readIssueStateStore } from "../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../helpers.js";
import { issueIdInput, requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates task-owner arguments before context resolution or effects. */
const taskOwnerInput = z.strictObject({
  channelId: requiredTextInput.describe("YOUR chat/group ID — the numeric ID of the chat you are in right now " +
    "(e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from."),
  issueId: issueIdInput.describe("Specific issue ID to claim. If omitted, claims all unclaimed queued issues.").optional(),
  force: z.boolean().describe("Override existing owner label (transfer ownership). Default: false.").optional(),
});

/** Create the task owner SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createTaskOwnerTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "task_owner",
    label: "Task Owner",
    description:
      "Claim issue(s) for this instance by adding an owner label. " +
      "If issueId is given, claims that specific issue. Otherwise claims all unclaimed queued issues. " +
      "Use force to transfer ownership from another instance.",
    parameters: toolInputParameters(taskOwnerInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = taskOwnerInput.parse(rawParams);
      const channelId = resolveChannelId(toolCtx, params.channelId);
      const issueIdParam = params.issueId;
      const force = params.force ?? false;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      const { project } = await resolveProject(workspaceDir, channelId);
      const { provider, type: providerType } = await resolveProvider(workspaceDir, project, ctx.runCommand);
      const resolvedConfig = await loadConfig(workspaceDir, project.slug);
      const instanceName = await loadInstanceName(
        workspaceDir,
        resolvedConfig.instanceName,
      );
      const ownerLabel = getOwnerLabel(instanceName);

      const claimed: number[] = [];
      const skipped: Array<{ issueId: number; reason: string }> = [];

      if (issueIdParam !== undefined) {
        // Claim a single issue
        const result = await claimManagedTask({
          workspaceDir, project, issueId: issueIdParam, instanceName, force,
          provider, providerType, workflow: resolvedConfig.workflow,
          roles: Object.keys(resolvedConfig.roles),
        });

        if (result.claimed) claimed.push(issueIdParam);
        else skipped.push({ issueId: issueIdParam, reason: result.reason });
      } else {
        // Claim all unclaimed queued issues
        const workflow = resolvedConfig.workflow;
        const queueLabels = getAllQueueLabels(workflow);
        const queueLabelSet: ReadonlySet<string> = new Set(queueLabels);
        const store = await readIssueStateStore(workspaceDir, project.slug);
        const candidateStates = Object.values(store.issues)
          .filter((state) =>
        state.integrityStatus !== ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR
            && state.providerMissing == null
            && queueLabelSet.has(state.workflowLabel),
          )
          .sort((a, b) => a.issueId - b.issueId);

        for (const state of candidateStates) {
          try {
            const claim = await claimManagedTask({
              workspaceDir, project, issueId: state.issueId, instanceName, force,
              provider, providerType, workflow,
              roles: Object.keys(resolvedConfig.roles),
            });

            if (claim.claimed) claimed.push(state.issueId);
            else skipped.push({ issueId: state.issueId, reason: claim.reason });
          } catch {
            skipped.push({ issueId: state.issueId, reason: "Provider fetch/update failed" });
          }
        }
      }

      return jsonResult({
        success: true,
        instanceName,
        ownerLabel,
        claimed,
        skipped,
        summary: `Claimed ${claimed.length} issue(s) for "${instanceName}"${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`,
      });
    },
  });
}
