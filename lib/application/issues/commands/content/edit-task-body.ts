/** Edits user task content under the issue lock while retaining authoritative managed metadata. */

import { DEFAULT_ROLES, getInitialStateLabel, STATE_TYPE } from "../../../../domain/index.js";
import { composeManagedIssueBody } from "../../../../projection/index.js";
import { getErrorMessage } from "../../../../shared/errors/index.js";
import {
  log as auditLog,
  withIssueOrchestrationLock,
} from "../../../../state/index.js";
import { EYES_EMOJI } from "../../../execution/feedback/index.js";
import { resolveProject } from "../../../projects/context/index.js";
import { TASK_EVENT } from "../const.js";
import type { TaskLifecycleTarget } from "../prerequisites/index.js";
import { readTaskLifecycleContext } from "../prerequisites/index.js";
import { TASK_EDIT_PREVIEW_LENGTH } from "./const.js";
import type { EditTaskBodyInput } from "./types.js";

/** Before and after user content retained for a bounded audit preview. */
type ContentChange = {
  /** Provider content before this edit. */
  from: string;
  /** Canonical content submitted by this edit. */
  to: string;
};

/** Serialize edits against task lifecycle transitions.
 * @param input - Requested content changes and project/provider transport.
 */
export async function editTaskBody(input: EditTaskBodyInput) {
  const target = await resolveProject(input.workspaceDir, input.channelId);

  return withIssueOrchestrationLock(input.workspaceDir, target.project.slug, input.issueId, () => editTaskBodyLocked(input, target));
}

/** Validate fresh local state before changing provider-visible user content.
 * @param input - Requested content and transport, with the issue lock already held.
 * @param target - Route and project captured before lock acquisition.
 */
async function editTaskBodyLocked(input: EditTaskBodyInput, target: TaskLifecycleTarget) {
  const {
    workspaceDir,
    issueId,
    title: newTitle,
    body: newBody,
    reason,
  } = input;
  const addComment = input.addComment ?? true;

  if (newTitle === undefined && newBody === undefined) {
    throw new Error("At least one of 'title' or 'body' must be provided.");
  }

  const { project, provider, providerType, resolvedConfig, issue, runtimeState } =
    await readTaskLifecycleContext(input, target, TASK_EVENT.EDIT_BODY);
  const initialStateLabel = getInitialStateLabel(resolvedConfig.workflow);
  //TODO: The behavior of the tester, reviewer, etc. is hard-coded.
  const architectActiveStates = Object.values(resolvedConfig.workflow.states)
    .filter((s) => s.type === STATE_TYPE.ACTIVE && s.role === DEFAULT_ROLES.ARCHITECT)
    .map((s) => s.label);
  const editableStates = [initialStateLabel, ...architectActiveStates];
  const editableStateSet: ReadonlySet<string> = new Set(editableStates);

  const currentState = runtimeState.workflowLabel;

  if (!currentState || !editableStateSet.has(currentState)) {
    throw new Error(
      `Cannot edit issue #${issueId}: it is in "${currentState ?? "unknown"}", ` +
      `but edits are only allowed in: ${editableStates.map(s => `"${s}"`).join(", ")}. ` +
      `Add a comment instead, or transition the issue first.`,
    );
  }

  const desiredBody = composeManagedIssueBody(newBody ?? issue.description, {
    projectSlug: project.slug, issueId,
  }, runtimeState.creationOperationId);
  const changes: Record<string, ContentChange> = {};

  if (newTitle !== undefined && newTitle !== issue.title) {
    changes.title = { from: issue.title, to: newTitle };
  }

  if (desiredBody !== issue.description) {
    changes.body = { from: issue.description, to: desiredBody };
  }

  if (Object.keys(changes).length === 0) {
    return {
      success: true,
      issueId,
      issueUrl: issue.web_url,
      project: project.name,
      changed: false,
    };
  }

  const updatedIssue = await provider.editIssue(issueId, {
    ...(newTitle !== undefined ? { title: newTitle } : {}),
    ...(changes.body ? { body: desiredBody } : {}),
  });

  if (addComment) {
    const timestamp = new Date().toISOString();
    const changeLines: string[] = [];

    if (changes.title) changeLines.push(`- **Title** updated`);
    if (changes.body) changeLines.push(`- **Description** updated`);
    const commentBody = [
      `📝 **Issue updated** at ${timestamp}`,
      ...changeLines,
      ...(reason ? [`- **Reason:** ${reason}`] : []),
    ].join("\n");

    provider.addComment(issueId, commentBody).then((commentId) => {
      provider.reactToIssueComment(issueId, commentId, EYES_EMOJI).catch(() => { });
    }).catch((err) => {
      auditLog(workspaceDir, TASK_EVENT.EDIT_BODY_WARNING, {
        step: "addComment", issueId, error: getErrorMessage(err),
      }).catch(() => { });
    });
  }

  await auditLog(workspaceDir, TASK_EVENT.EDIT_BODY, {
    project: project.name,
    issueId,
    issueUrl: updatedIssue.web_url,
    provider: providerType,
    changes: Object.fromEntries(
      Object.entries(changes).map(([k, v]) => [k, { from: v.from.slice(0, TASK_EDIT_PREVIEW_LENGTH), to: v.to.slice(0, TASK_EDIT_PREVIEW_LENGTH) }]),
    ),
    reason: reason ?? null,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    issueId,
    issueTitle: updatedIssue.title,
    issueUrl: updatedIssue.web_url,
    project: project.name,
    provider: providerType,
    changed: true,
    changes: Object.keys(changes),
    reason,
  };
}
