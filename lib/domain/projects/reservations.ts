/** Queries project reservations without establishing authoritative issue runtime ownership. */

import type { WorkerRunIdentity } from "../workers/index.js";
import { findSlotByIssue, slotOwnsWorkerRun } from "./slots.js";
import type { Project, ProjectIssueReservation } from "./types.js";

/** Compare reservation evidence with an independently authorized issue worker frame.
 * Timestamp comparison retains the slot contract; this never creates issue ownership.
 * Active flags and delivery-token requirements remain with the caller.
 * @param reservation - Observed reservation, if one exists.
 * @param issueId - Authoritative managed issue identifier.
 * @param worker - Worker frame read from local issue state or a matching completion receipt.
 */
export function reservationMatchesWorkerRun(
  reservation: ProjectIssueReservation | null, issueId: number, worker: WorkerRunIdentity,
): boolean {
  return reservation !== null && reservation.role === worker.role && reservation.level === worker.level
    && reservation.slotIndex === worker.slotIndex && slotOwnsWorkerRun(reservation.slot, issueId, worker);
}

/** Detect any retained issue reference, including inactive reservations awaiting recovery.
 * @param project - Fresh project reservation snapshot.
 * @param issueId - Provider-local issue identifier.
 */
export function hasProjectWorkerSlot(project: Project, issueId: number): boolean {
  return Object.values(project.workers).some(worker => findSlotByIssue(worker, issueId) !== null);
}

/** Select one reservation; ambiguous references fail closed and never imply workflow state.
 * @param project - Project reservation snapshot, absent for an unregistered project.
 * @param issueId - Issue whose reservation is inspected.
 */
export function findProjectIssueReservation(project: Project | undefined, issueId: number): ProjectIssueReservation | null {
  const matches: ProjectIssueReservation[] = [];

  for (const [role, worker] of Object.entries(project?.workers ?? {})) {
    for (const [level, slots] of Object.entries(worker.levels)) {
      for (const [slotIndex, slot] of (slots ?? []).entries()) {
        if (slot.issueId === issueId) matches.push({ role, level, slotIndex, slot });
      }
    }
  }

  if (matches.length > 1) throw new Error(`Issue #${issueId} has ambiguous worker slot ownership.`);

  return matches[0] ?? null;
}
