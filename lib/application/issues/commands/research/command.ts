/** Creates or resumes research, then serializes exact-issue scheduling against local worker ownership. */

import { DEFAULT_ROLES, EXECUTION_MODE, findAvailableWorkerSlot, workerExecutionBlock } from "../../../../domain/index.js";
import { loadInstanceName } from "../../../../instance.js";
import { stripManagedIssueBody } from "../../../../projection/index.js";
import { resolveModelForLevel, selectLevel } from "../../../../roles/index.js";
import { getRoleWorker, loadConfig, readProjects } from "../../../../state/index.js";
import { resolveProject, resolveProvider } from "../../../projects/context/index.js";
import { createManagedTaskIssue } from "../creation/index.js";
import { RESEARCH_CREATION_PREFIX, RESEARCH_STATUS } from "./const.js";
import { planResearchWorkflow } from "./plan.js";
import { scheduleResearch } from "./scheduling.js";
import type { ResearchTaskInput, ResearchTaskResult } from "./types.js";

/** Resume the same creation and never submit another turn while the issue has ownership or uncertain delivery.
 * @param input - Stable caller request, SDK context and explicit integration dependencies.
 */
export async function researchTask(input: ResearchTaskInput): Promise<ResearchTaskResult> {
  const { project, endpoint } = await resolveProject(input.workspaceDir, input.channelId);
  const config = await loadConfig(input.workspaceDir, project.slug);
  const plan = planResearchWorkflow(config.workflow, input.workflowState);
  const roleConfig = config.roles[DEFAULT_ROLES.ARCHITECT];

  if (!roleConfig?.enabled) throw new Error("Architect role is unavailable.");
  const level = selectLevel(input.title, input.description, plan.role, roleConfig, input.complexity).level;
  const model = resolveModelForLevel(level, roleConfig);
  const base = { project: project.name, level, model, label: plan.queueLabel };
  const projectExecution = input.pluginConfig?.projectExecution === EXECUTION_MODE.SEQUENTIAL ? EXECUTION_MODE.SEQUENTIAL : EXECUTION_MODE.PARALLEL;

  const body = ["## Background", "", input.description,
    ...(input.focusAreas?.length ? ["", "## Focus Areas", ...input.focusAreas.map(area => `- ${area}`)] : [])].join("\n");

  stripManagedIssueBody(body);
  if (input.dryRun) {
    const registry = await readProjects(input.workspaceDir);
    const fresh = registry.projects[project.slug];

    if (!fresh) throw new Error("Project disappeared while planning research.");
    const exclusion = workerExecutionBlock(registry.projects, project.slug, plan.role, config.workflow.roleExecution, projectExecution);
    const slot = findAvailableWorkerSlot(getRoleWorker(fresh, plan.role), level, roleConfig.levels[level]?.maxWorkers ?? 0);

    return { ...base, success: true, status: RESEARCH_STATUS.DRY_RUN,
      reason: exclusion ?? (slot === null ? "Configured capacity is exhausted; research would be queued." : undefined) };
  }

  const provider = input.provider ?? (await resolveProvider(input.workspaceDir, project, input.runCommand)).provider;
  const creation = await createManagedTaskIssue({ workspaceDir: input.workspaceDir, project, providerType: project.provider, provider,
    workflow: config.workflow, roles: Object.keys(config.roles), title: input.title, description: body,
    workflowState: plan.queueState, assignedRole: plan.role, assignedLevel: level,
    owner: await loadInstanceName(input.workspaceDir, config.instanceName), notifyTarget: { channel: endpoint.channel, name: endpoint.name },
    idempotencyKey: `${RESEARCH_CREATION_PREFIX}${input.idempotencyKey}`, requestedBy: input.agentId ?? project.agentId });
  const result = { ...base, creation, issue: creation.issue };
  const issue = creation.issue;

  if (!creation.success || !issue) return { ...result, success: false, status: RESEARCH_STATUS.CREATION_PENDING };

  return scheduleResearch({ ...input, provider }, creation, issue, base, projectExecution);
}
