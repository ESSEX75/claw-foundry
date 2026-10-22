/** Selects reservable capacity and execution exclusions from project reservation snapshots. */

import { EXECUTION_MODE, type ExecutionMode } from "../workflow/index.js";
import { countActiveSlots, isWorkerSlotAvailable } from "./slots.js";
import type { Project, RoleWorkerState } from "./types.js";

/** Detect a different project's active reservation without inferring issue workflow state.
 * @param projects - Complete fresh project registry snapshot.
 * @param projectSlug - Project requesting capacity.
 */
export function hasOtherProjectReservation(projects: Readonly<Record<string, Project>>, projectSlug: string): boolean {
  return Object.values(projects).some(project => project.slug !== projectSlug
    && Object.values(project.workers).some(worker => countActiveSlots(worker) > 0));
}

/** Select a free index within configured capacity, excluding unreconciled issue references.
 * @param worker - Persisted slots, including slots left by removed configuration.
 * @param level - Configured level being reserved.
 * @param capacity - Maximum concurrent slots permitted for this level.
 */
export function findAvailableWorkerSlot(worker: RoleWorkerState, level: string, capacity: number): number | null {
  const slots = worker.levels[level] ?? [];

  if (!Number.isSafeInteger(capacity) || capacity <= 0 || slots.filter(slot => slot.active).length >= capacity) return null;
  for (let index = 0; index < capacity; index++) {
    const slot = slots[index];

    if (!slot || isWorkerSlotAvailable(slot)) return index;
  }

  return null;
}

/** Explain a sequential execution exclusion without changing issue workflow state.
 * @param projects - Fresh reservation snapshot for every project in the workspace.
 * @param projectSlug - Project requesting capacity.
 * @param role - Role requesting a slot within that project.
 * @param roleExecution - Whether another role may run in the same project.
 * @param projectExecution - Whether a different project may run concurrently.
 */
export function workerExecutionBlock(projects: Readonly<Record<string, Project>>, projectSlug: string, role: string,
  roleExecution?: ExecutionMode, projectExecution?: ExecutionMode): string | undefined {
  if (projectExecution === EXECUTION_MODE.SEQUENTIAL && hasOtherProjectReservation(projects, projectSlug)) {
    return "Sequential: another project has an active reservation.";
  }

  for (const project of Object.values(projects)) {
    for (const [candidate, worker] of Object.entries(project.workers)) {
      if (countActiveSlots(worker) === 0) continue;
      if (project.slug === projectSlug && candidate !== role && roleExecution === EXECUTION_MODE.SEQUENTIAL) return "Sequential: another role has an active reservation.";
    }
  }

  return undefined;
}
