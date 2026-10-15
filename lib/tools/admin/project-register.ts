/**
 * project_register — Register a new project with DevClaw.
 *
 * Atomically validates the repository, detects its provider, ensures configured labels,
 * adds project entry to projects.json, and logs the event.
 *
 * Replaces the manual steps of running glab/gh label create + editing projects.json.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { registerProject } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { NOTIFICATION_CHANNEL } from "../../domain/index.js";
import { requireWorkspaceDir } from "../helpers.js";
import { requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates project-register arguments before context resolution or effects. */
const projectRegisterInput = z.strictObject({
  channelId: requiredTextInput.describe("Channel ID — the chat/group ID where this project is managed (e.g. Telegram group ID)"),
  accountId: requiredTextInput.describe("Explicit OpenClaw channel account ID used by this project."),
  name: requiredTextInput.describe("Short project name (e.g. 'my-webapp')"),
  repo: requiredTextInput.describe("Path to git repo (e.g. '~/git/my-project')"),
  channel: z.enum(Object.values(NOTIFICATION_CHANNEL)).describe("Channel type (e.g. 'telegram', 'whatsapp'). Defaults to 'telegram'.").optional(),
  threadId: requiredTextInput.describe("Optional thread/topic ID for forum-style channels, e.g. Telegram topic ID.").optional(),
  baseBranch: requiredTextInput.describe("Base branch for development (e.g. 'development', 'main')"),
  deployBranch: requiredTextInput.describe("Branch that triggers deployment. Defaults to baseBranch.").optional(),
});

/**
 * Create the OpenClaw adapter for project registration and label provisioning.
 *
 * @param ctx - Plugin services used for commands, provider access, and audit logging.
 */
export function createProjectRegisterTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "project_register",
    label: "Project Register",
    description: `Register a new project with DevClaw. Creates state labels, adds to projects.json. One-time setup per project.`,
    parameters: toolInputParameters(projectRegisterInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = projectRegisterInput.parse(rawParams);
      const agentId = toolCtx.agentId;

      if (!agentId) throw new Error("DevClaw project registration requires an agent context.");
      const result = await registerProject({
        workspaceDir: requireWorkspaceDir(toolCtx), name: params.name, repo: params.repo,
        baseBranch: params.baseBranch, deployBranch: params.deployBranch, agentId,
        route: { channel: params.channel ?? NOTIFICATION_CHANNEL.TELEGRAM, accountId: params.accountId.trim(),
          channelId: params.channelId, threadId: params.threadId?.trim() },
        getConfig: () => ctx.runtime.config.current(), runCommand: ctx.runCommand,
      });
      const { project, endpoint } = result;

      return jsonResult({
        success: !result.scaffoldError, status: result.scaffoldError ? "scaffold_pending" : "ready",
        registrationCommitted: true, project: project.name, projectSlug: project.slug,
        repo: project.repo, baseBranch: project.baseBranch, deployBranch: project.deployBranch,
        channelId: endpoint.channelId, accountId: endpoint.accountId, threadId: endpoint.threadId,
        labelsCreated: result.labelsEnsured, promptsScaffolded: result.promptsScaffolded, isNewProject: result.isNewProject,
        activeWorkflow: {
          reviewPolicy: result.workflow.reviewPolicy,
          testPhase: Object.values(result.workflow.states).some(state => state.role === "tester" && (state.type === "queue" || state.type === "active")),
          hint: "Call workflow_guide to change review policy or enable testing.",
        },
        error: result.scaffoldError, recovery: result.scaffoldError ? "Retry the same registration to finish scaffolding." : undefined,
        announcement: result.scaffoldError ? `Project "${project.name}" is registered; scaffold is pending: ${result.scaffoldError}`
          : `Project "${project.name}" registered. Labels ensured. Ready for tasks.`,
      });
    },
  });
}
