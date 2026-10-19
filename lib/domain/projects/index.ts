/** Exposes supported project and worker-slot semantics to the domain package. */

export { findAvailableWorkerSlot, hasOtherProjectReservation, workerExecutionBlock } from "./execution.js";
export { findProjectIssueReservation, hasProjectWorkerSlot, reservationMatchesWorkerRun } from "./reservations.js";
export {
  countActiveSlots,
  emptyRoleWorkerState,
  emptySlot,
  findSlotByIssue,
  reconcileSlots,
  releasedWorkerSlot,
  sameSlotReservation,
  slotOwnsWorkerRun,
} from "./slots.js";
export type { Project, RoleWorkerState, SlotLocation, SlotState } from "./types.js";
export type { ProjectIssueReservation } from "./types.js";
