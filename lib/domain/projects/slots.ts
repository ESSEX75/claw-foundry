/**
 * projects/slots.ts — Pure slot helpers (no I/O).
 */

import type { WorkerRunIdentity } from "../workers/index.js";
import type { RoleWorkerState, SlotLocation, SlotState } from "./types.js";

// ---------------------------------------------------------------------------
// Slot helpers
// ---------------------------------------------------------------------------

/** Create an empty (inactive) slot. */
export function emptySlot(): SlotState {
  return {
    active: false,
    issueId: null,
    sessionKey: null,
    startTime: null,
  };
}

/**
 * Check whether capacity can be recycled without discarding unresolved ownership.
 * Reusable session and display metadata do not reserve capacity.
 *
 * @param slot - Reservation snapshot being considered for reuse or removal.
 */
export function isWorkerSlotAvailable(slot: SlotState): boolean {
  return !slot.active && slot.issueId === null && slot.delivery === undefined;
}

/**
 * Create a blank role-worker state with the configured per-level capacities.
 *
 * @param levelMaxWorkers - Maximum slot count keyed by resolved level identifier.
 */
export function emptyRoleWorkerState(
  levelMaxWorkers: Partial<Record<string, number>>,
): RoleWorkerState {
  const levels: Partial<Record<string, SlotState[]>> = {};

  for (const [level, max] of Object.entries(levelMaxWorkers)) {
    if (max === undefined) continue;

    levels[level] = [];
    for (let i = 0; i < max; i++) {
      levels[level]!.push(emptySlot());
    }
  }

  return { levels };
}

/**
 * Reconcile a role's levels with the configured per-level maxWorkers.
 * - Adds missing levels, expands short arrays, shrinks idle trailing slots.
 * - Removes unconfigured levels only after every reservation has been released.
 * Active workers, issue references and unresolved delivery evidence are retained.
 * Mutates roleWorker in place. Returns true if any changes were made.
 *
 * @param roleWorker - Mutable role-owned worker state to reconcile.
 * @param levelMaxWorkers - Desired maximum slot count keyed by level identifier.
 */
export function reconcileSlots(
  roleWorker: RoleWorkerState,
  levelMaxWorkers: Partial<Record<string, number>>,
): boolean {
  let changed = false;
  const configuredLevels = new Set<string>();

  for (const [level, max] of Object.entries(levelMaxWorkers)) {
    if (max === undefined) continue;
    configuredLevels.add(level);

    if (!roleWorker.levels[level]) {
      roleWorker.levels[level] = [];
      changed = true;
    }

    const slots = roleWorker.levels[level]!;

    while (slots.length < max) {
      slots.push(emptySlot());
      changed = true;
    }

    while (slots.length > max) {
      const last = slots[slots.length - 1]!;

      if (!isWorkerSlotAvailable(last)) break;
      slots.pop();
      changed = true;
    }
  }

  for (const [level, slots] of Object.entries(roleWorker.levels)) {
    if (configuredLevels.has(level) || slots === undefined) continue;
    if (slots.some((slot) => !isWorkerSlotAvailable(slot))) continue;

    delete roleWorker.levels[level];
    changed = true;
  }

  return changed;
}

/**
 * Find the level and slot index for a given issue ID, or null if not found.
 *
 * @param roleWorker - Role-owned worker slots to inspect.
 * @param issueId - Stable issue identifier assigned to the requested slot.
 */
export function findSlotByIssue(roleWorker: RoleWorkerState, issueId: number): SlotLocation | null {
  for (const [level, slots] of Object.entries(roleWorker.levels)) {
    if (slots === undefined) continue;

    for (let i = 0; i < slots.length; i++) {
      if (slots[i]!.issueId === issueId) return { level, slotIndex: i };
    }
  }

  return null;
}

/**
 * Count the number of active slots across all levels.
 *
 * @param roleWorker - Role-owned worker slots to count.
 */
export function countActiveSlots(roleWorker: RoleWorkerState): number {
  let count = 0;

  for (const slots of Object.values(roleWorker.levels)) {
    if (slots === undefined) continue;

    for (const slot of slots) {
      if (slot.active) count++;
    }
  }

  return count;
}

/** Clear a verified reservation while retaining reusable session and display metadata.
 * The caller must validate ownership before applying this transformation.
 * @param slot - Slot whose run has been explicitly released.
 * @param issueId - Released issue retained for same-issue context policy.
 */
export function releasedWorkerSlot(slot: SlotState, issueId: number | null): SlotState {
  return { ...slot, active: false, issueId: null, startTime: null, previousLabel: null,
    delivery: undefined, lastIssueId: issueId };
}

/** Check the issue and exact reusable-session run represented by a selected slot.
 * Slot coordinates and delivery-token requirements remain with the caller.
 * @param slot - Fresh selected reservation, if present.
 * @param issueId - Expected provider-local issue identity.
 * @param worker - Captured exact session and start timestamp.
 */
export function slotOwnsWorkerRun(slot: SlotState | undefined, issueId: number, worker: Pick<WorkerRunIdentity, "sessionKey" | "startedAt">): boolean {
  return slot !== undefined && slot.issueId === issueId && slot.sessionKey === worker.sessionKey && (slot.startTime ?? "") === worker.startedAt;
}

/** Compare a captured reservation before health mutates or releases it; delivery replacements are fenced.
 * @param actual - Fresh registry slot.
 * @param expected - Reservation captured during diagnosis.
 */
export function sameSlotReservation(actual: SlotState | undefined, expected: SlotState): boolean {
  return actual !== undefined && actual.active === expected.active && actual.issueId === expected.issueId
    && actual.sessionKey === expected.sessionKey && actual.startTime === expected.startTime
    && actual.delivery?.operationId === expected.delivery?.operationId;
}
