/** Exposes supported project and worker-slot semantics to the domain package. */

export { findAvailableWorkerSlot, workerExecutionBlock } from "./execution.js";
export {
  countActiveSlots,
  emptyRoleWorkerState,
  emptySlot,
  findFreeSlot,
  findSlotByIssue,
  reconcileSlots,
  releasedWorkerSlot,
  sameSlotReservation,
  slotOwnsWorkerRun,
} from "./slots.js";
export type { Project, RoleWorkerState, SlotLocation, SlotState } from "./types.js";
