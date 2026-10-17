/** Renders dispatch facts for the research tool without influencing worker delivery. */

import type { DispatchResult } from "../../../application/index.js";
import { WORKER_SESSION_ACTION } from "../../../domain/index.js";

/** Render the selected worker and observed session action.
 * @param result - Confirmed application dispatch facts.
 */
export function renderDispatchAnnouncement(result: DispatchResult): string {
  const { emoji, sessionAction, role, botName, level, issueId, issueTitle, issueUrl } = result;
  const actionVerb = sessionAction === WORKER_SESSION_ACTION.SPAWN ? "Spawning" : "Sending";
  const nameTag = botName ? ` ${botName}` : "";

  return `${emoji} ${actionVerb} ${role.toUpperCase()}${nameTag} (${level}) for #${issueId}: ${issueTitle}\n📋 [Issue #${issueId}](${issueUrl})`;
}
