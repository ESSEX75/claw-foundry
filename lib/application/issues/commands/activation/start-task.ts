/** Owns a managed task lifecycle operation or its pure transition decision. */

import {
  log as auditLog,
  withIssueOrchestrationLock,
} from "../../../../state/index.js";
import { resolveProject } from "../../../projects/context/index.js";
import {
  reconcileManagedLabelsLocked,
  transitionWorkflowLabel,
} from "../../projection/index.js";
import { writeIssueRuntimeState } from "../../runtime/index.js";
import { TASK_EVENT } from "../const.js";
import type { TaskLifecycleTarget } from "../prerequisites/index.js";
import { readTaskLifecycleContext } from "../prerequisites/index.js";
import { resolveStartTaskDecision } from "./lifecycle-decision.js";
import type { StartTaskInput, StartTaskResult } from "./types.js";

/** Serialize approval of a held task with other lifecycle commands.
 * @param input - Validated command dependencies and requested changes.
 */
export async function startTask(input: StartTaskInput): Promise<StartTaskResult> {
  const { workspaceDir, channelId, issueId } = input;
  const target = await resolveProject(workspaceDir, channelId);

  return withIssueOrchestrationLock(workspaceDir, target.project.slug, issueId, () => startTaskLocked(input, target));
}

/** Validate fresh state and commit the configured approval transition.
 * @param input - Validated command dependencies and requested changes.
 * @param target - Route and project captured before lock acquisition.
 */
async function startTaskLocked(input: StartTaskInput, target: TaskLifecycleTarget): Promise<StartTaskResult> {
  const { workspaceDir, issueId } = input;
  const { project, provider, providerType, resolvedConfig, issue, runtimeState, currentState } =
    await readTaskLifecycleContext(input, target, TASK_EVENT.START);
  const workflow = resolvedConfig.workflow;

  const decision = resolveStartTaskDecision({
    workflow,
    currentState,
    runtimeState,
    roles: resolvedConfig.roles,
    requestedLevel: input.level,
    issueTitle: issue.title,
    issueDescription: issue.description ?? "",
  });

  await transitionWorkflowLabel(provider, workflow, issueId, decision.fromLabel, decision.targetLabel);

  const configuredRoleIds = Object.keys(resolvedConfig.roles);
  const nextLabels = issue.labels
    .filter((candidate) => candidate !== decision.fromLabel)
    .filter((candidate) => !configuredRoleIds.some((role) => candidate.startsWith(`${role}:`)))
    .concat(decision.targetLabel, `${decision.targetRole}:${decision.assignedLevel}`);

  await writeIssueRuntimeState({
    workspaceDir,
    project,
    issue: { ...issue, labels: nextLabels },
    providerType,
    workflow,
    workflowLabel: decision.targetLabel,
    workflowState: decision.targetStateKey,
    assignedRole: decision.targetRole,
    assignedLevel: decision.assignedLevel,
  });

  await reconcileManagedLabelsLocked({
    workspaceDir,
    projectSlug: project.slug,
    issueId,
    workflow,
    roles: configuredRoleIds,
    provider,
    owner: TASK_EVENT.START,
  });

  await auditLog(workspaceDir, TASK_EVENT.START, {
    project: project.name, issueId,
    from: decision.fromLabel, to: decision.targetLabel,
    transitioned: true, level: decision.assignedLevel,
  });

  return {
    success: true, issueId, issueTitle: issue.title,
    from: decision.fromLabel, to: decision.targetLabel, transitioned: true,
    level: decision.assignedLevel,
    project: project.name,
  };
}
