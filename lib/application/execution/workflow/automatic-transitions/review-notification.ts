/** Delivers optional review events only to the issue's persisted exact endpoint. */

import { log as auditLog } from "../../../../audit.js";
import { getErrorMessage } from "../../../../shared/errors/index.js";
import { notify, resolveIssueNotificationEndpoint } from "../../../notifications/index.js";
import { REVIEW_NOTIFICATION_ERROR } from "./const.js";
import type { ReviewNotificationInput } from "./types.js";

/** Send a review event using the same binding resolver as pipeline notifications.
 * An absent or stale binding produces a blocked notification diagnostic; no primary-channel fallback is used.
 * @param input - Issue identity, project endpoints, event, and delivery capabilities.
 */
export async function notifyReviewEvent(input: ReviewNotificationInput): Promise<void> {
  const { workspaceDir, project, issueId, event, config, runtime, runCommand } = input;

  try {
    const target = await resolveIssueNotificationEndpoint(workspaceDir, project, issueId);

    await notify(event, { workspaceDir, config, channelId: target?.channelId, channel: target?.channel,
      accountId: target?.accountId, threadId: target?.threadId, agentId: project.agentId, runtime, runCommand });
  } catch (error) {
    await auditLog(workspaceDir, REVIEW_NOTIFICATION_ERROR, { projectSlug: project.slug, issueId,
      event: event.type, error: getErrorMessage(error) }).catch(() => {});
  }
}
