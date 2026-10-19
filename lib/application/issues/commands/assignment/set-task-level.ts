/** Owns a managed task lifecycle operation or its pure transition decision. */

import { log as auditLog } from "../../../../audit.js";
import { validateRoleLevel } from "../../../../roles/index.js";
import { withIssueOrchestrationLock } from "../../../../state/index.js";
import { resolveProject } from "../../../projects/context/index.js";
import { reconcileManagedLabelsLocked } from "../../projection/index.js";
import { writeIssueRuntimeState } from "../../runtime/index.js";
import { TASK_EVENT } from "../const.js";
import type { TaskLifecycleTarget } from "../prerequisites/index.js";
import { readTaskLifecycleContext } from "../prerequisites/index.js";
import { resolveHoldQueueTarget } from "../prerequisites/index.js";
import type { SetTaskLevelInput, SetTaskLevelResult } from "./types.js";

/** Serialize an explicit level change with issue lifecycle transitions.
 * @param input - Validated command dependencies and requested changes.
 */
export async function setTaskLevel(input: SetTaskLevelInput): Promise<SetTaskLevelResult> {
  const target = await resolveProject(input.workspaceDir, input.channelId);

  return withIssueOrchestrationLock(
    input.workspaceDir,
    target.project.slug,
    input.issueId,
    () => setTaskLevelLocked(input, target),
  );
}

/** Recheck creation, integrity, and worker ownership before preparing an assignment.
 * @param input - Validated command dependencies and requested changes.
 * @param capturedTarget - Route and project captured before lock acquisition.
 */
async function setTaskLevelLocked(input: SetTaskLevelInput, capturedTarget: TaskLifecycleTarget): Promise<SetTaskLevelResult> {
  const { workspaceDir, issueId, level } = input;
  const { project, provider, providerType, resolvedConfig, issue, runtimeState, currentState } =
    await readTaskLifecycleContext(input, capturedTarget, TASK_EVENT.SET_LEVEL);

  const target = resolveHoldQueueTarget(resolvedConfig.workflow, currentState);
  const role = target.state.role;
  const roleConfig = resolvedConfig.roles[role];

  if (!roleConfig) throw new Error(`Target role "${role}" is not configured.`);
  if (!roleConfig.enabled) throw new Error(`Role "${role}" is disabled.`);

  validateRoleLevel(role, level, roleConfig);

  const fromLevel = runtimeState.assignedRole === role
    ? runtimeState.assignedLevel ?? null
    : null;
  const changed = runtimeState.assignedRole !== role || fromLevel !== level;
  const configuredRoleIds = Object.keys(resolvedConfig.roles);
  const nextLabels = issue.labels
    .filter((label) => !configuredRoleIds.some((roleId) => label.startsWith(`${roleId}:`)))
    .concat(`${role}:${level}`);

  await writeIssueRuntimeState({
    workspaceDir,
    project,
    issue: { ...issue, labels: nextLabels },
    providerType,
    workflow: resolvedConfig.workflow,
    workflowLabel: runtimeState.workflowLabel,
    workflowState: runtimeState.workflowState,
    assignedRole: role,
    assignedLevel: level,
  });

  await reconcileManagedLabelsLocked({
    workspaceDir,
    projectSlug: project.slug,
    issueId,
    workflow: resolvedConfig.workflow,
    roles: configuredRoleIds,
    provider,
    owner: TASK_EVENT.SET_LEVEL,
  });

  await auditLog(workspaceDir, TASK_EVENT.SET_LEVEL, {
    project: project.name,
    issueId,
    ...(changed ? { fromLevel, toLevel: level } : {}),
    reason: input.reason ?? null,
    provider: providerType,
  });

  return {
    success: true,
    issueId,
    issueTitle: issue.title,
    level,
    changed,
    project: project.name,
    provider: providerType,
    fromLevel, reason: input.reason,
  };
}
