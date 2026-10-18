/** Selects reservable capacity and execution exclusions from project reservation snapshots. */

import { EXECUTION_MODE, type ExecutionMode } from "../workflow/index.js";
import { countActiveSlots } from "./slots.js";
import type { Project, RoleWorkerState } from "./types.js";

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

    if (!slot || (!slot.active && slot.issueId === null)) return index;
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
  for (const project of Object.values(projects)) {
    for (const [candidate, worker] of Object.entries(project.workers)) {
      if (countActiveSlots(worker) === 0) continue;
      if (project.slug !== projectSlug && projectExecution === EXECUTION_MODE.SEQUENTIAL) return "Sequential: another project has an active reservation.";
      if (project.slug === projectSlug && candidate !== role && roleExecution === EXECUTION_MODE.SEQUENTIAL) return "Sequential: another role has an active reservation.";
    }
  }

  return undefined;
}
