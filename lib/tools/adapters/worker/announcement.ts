/** Renders a completion announcement without provider or state access. */

import type { FinishWorkResult } from "../../../application/index.js";
import { getCompletionEmoji } from "../../../domain/index.js";

/** Render a completed workflow outcome for the work_finish tool.
 * @param opts - Committed completion facts, including exact failure diagnostics.
 */
export function renderCompletionAnnouncement(opts: FinishWorkResult): string {
  const { issueUrl = "", prUrl, nextState } = opts;

  if (opts.mergeFailure) return `⚠️ MERGE FAILED #${opts.issueId} — ${opts.mergeFailure}\n📋 [Issue #${opts.issueId}](${issueUrl})\n→ ${nextState}.`;
  const { role, result, issueId, summary, createdTasks } = opts;
  const key = `${role}:${result}`;
  // Build announcement using workflow-derived emoji
  const emoji = getCompletionEmoji(result);
  const label = key.replace(":", " ").toUpperCase();
  let announcement = `${emoji} ${label} #${issueId}`;

  if (summary) announcement += ` — ${summary}`;
  announcement += `\n📋 [Issue #${issueId}](${issueUrl})`;
  if (prUrl) announcement += `\n🔗 [PR](${prUrl})`;
  if (createdTasks && createdTasks.length > 0) {
    announcement += `\n📌 Created tasks:`;
    for (const t of createdTasks) {
      announcement += `\n  - [#${t.id}: ${t.title}](${t.url})`;
    }
  }

  announcement += `\n${nextState}.`;

  return announcement;
}
