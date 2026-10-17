/** Checks project worker reservations for managed issue administration. */

import { type ActiveIssueWorker, findSlotByIssue, type Project } from "../../../domain/index.js";

/** Return whether any project role still reserves a slot for the issue.
 * @param project - Fresh or explicitly captured project registry state.
 * @param issueId - Provider-local issue whose reservation is checked.
 */
export function hasProjectWorkerSlot(project: Project, issueId: number): boolean {
  return Object.values(project.workers).some((worker) => findSlotByIssue(worker, issueId) !== null);
}

/** Capture one project slot identity before committing; ambiguous references fail closed.
 * @param project - Fresh registry snapshot, absent for a workspace without workers.
 * @param issueId - Issue whose completing worker is selected.
 */
export function findProjectIssueWorker(project: Project | undefined, issueId: number): ActiveIssueWorker | null {
  const matches: ActiveIssueWorker[] = [];

  for (const [role, worker] of Object.entries(project?.workers ?? {})) {
    for (const [level, slots] of Object.entries(worker.levels)) {
      for (const [slotIndex, slot] of (slots ?? []).entries()) {
        if (slot.issueId === issueId) matches.push({ role, level, slotIndex, sessionKey: slot.sessionKey, startedAt: slot.startTime ?? "", delivery: slot.delivery });
      }
    }
  }

  if (matches.length > 1) throw new Error(`Issue #${issueId} has ambiguous worker slot ownership.`);

  return matches[0] ?? null;
}
