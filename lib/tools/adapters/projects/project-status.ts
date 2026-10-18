/**
 * project_status — Instant local project info for the current channel.
 *
 * Returns project registration, channel bindings, worker slot states,
 * workflow config, and execution settings. No issue-tracker API calls.
 * Use `tasks_status` for live issue counts.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { getIssueArchiveStatus, resolveProject } from "../../../application/index.js";
import type { PluginContext } from "../../../context.js";
import { DEFAULT_ROLES, EXECUTION_MODE, REVIEW_POLICY, STATE_TYPE } from "../../../domain/index.js";
import { loadInstanceName } from "../../../instance.js";
import { getLevelMaxWorkers, loadConfig } from "../../../state/index.js";
import { requireWorkspaceDir, resolveChannelId } from "../../context/index.js";
import { channelIdInput, toolInputParameters } from "../../validation/index.js";
import { PROJECT_STATUS_TOOL_NAME } from "./const.js";
import type { ProjectWorkerSlotSummary, ProjectWorkerSummary } from "./types.js";

/** Validates project-status arguments before context resolution or effects. */
const projectStatusInput = z.strictObject({
  channelId: channelIdInput,
});

/** Create the project status SDK adapter with validated command input.
 * @param ctx - Plugin capabilities used after boundary validation.
 */
export function createProjectStatusTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: PROJECT_STATUS_TOOL_NAME,
    label: "Project Status",
    description:
      "Instant project info for this channel: registration, channels, worker slots, workflow, and config. " +
      "No API calls — all local data. Use `tasks_status` for live issue counts from the issue tracker.",
    parameters: toolInputParameters(projectStatusInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = projectStatusInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const channelId = resolveChannelId(toolCtx, params.channelId);

      const { project } = await resolveProject(workspaceDir, channelId);

      const pluginConfig = ctx.pluginConfig;
      const projectExecution = z.enum(EXECUTION_MODE).parse(pluginConfig?.projectExecution ?? EXECUTION_MODE.PARALLEL);

      const projectConfig = await loadConfig(workspaceDir, project.slug);
      const workflow = projectConfig.workflow;
      const instanceName = await loadInstanceName(workspaceDir, projectConfig.instanceName);
      const issueArchive = await getIssueArchiveStatus({
        workspaceDir,
        projectSlug: project.slug,
        archiveRetention: projectConfig.issueArchiveMaintenance.archiveRetention,
        deletedProviderRetention: projectConfig.issueArchiveMaintenance.deletedProviderRetention,
        workflow: projectConfig.workflow,
      });

      // Workers summary - per-level slot utilization
      const workers: Record<string, ProjectWorkerSummary> = {};

      for (const [role, rw] of Object.entries(project.workers)) {
        const levelMaxWorkers = getLevelMaxWorkers(projectConfig.roles[role]);
        let activeSlots = 0;
        const levels: Record<string, ProjectWorkerSlotSummary[]> = {};

        for (const [level, slots] of Object.entries(rw.levels)) {
          if (slots === undefined) continue;

          levels[level] = slots.map(slot => ({
            active: slot.active,
            issueId: slot.issueId,
            startTime: slot.startTime,
          }));
          activeSlots += slots.filter(s => s.active).length;
        }

        workers[role] = { levelMaxWorkers, activeSlots, levels };
      }

      const hasTestPhase = Object.values(workflow.states).some(
        (s) => s.role === DEFAULT_ROLES.TESTER && (s.type === STATE_TYPE.QUEUE || s.type === STATE_TYPE.ACTIVE),
      );
      const workflowSummary = {
        reviewPolicy: workflow.reviewPolicy ?? REVIEW_POLICY.HUMAN,
        roleExecution: workflow.roleExecution ?? EXECUTION_MODE.PARALLEL,
        testPhase: hasTestPhase,
        stateFlow: Object.entries(workflow.states)
          .map(([, s]) => s.label)
          .join(" → "),
      };

      return jsonResult({
        success: true,
        instanceName,
        execution: { projectExecution },
        project: {
          name: project.name,
          slug: project.slug,
          repo: project.repo,
          provider: project.provider,
          baseBranch: project.baseBranch,
          deployBranch: project.deployBranch,
          channels: project.channels,
        },
        workflow: workflowSummary,
        issueArchive,
        workers,
      });
    },
  });
}
