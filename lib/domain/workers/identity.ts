/** Compares exact worker run identities without trusting a reusable session alone. */

import type { WorkerRunIdentity } from "./types.js";

/** Compare every coordinate of two captured runs; absent runs never match.
 * @param actual - Fresh locally owned run, if any.
 * @param expected - Captured run authorizing the operation.
 */
export function sameWorkerRun(actual: WorkerRunIdentity | null | undefined, expected: WorkerRunIdentity): boolean {
  return actual != null && actual.role === expected.role && actual.level === expected.level
    && actual.slotIndex === expected.slotIndex && actual.sessionKey === expected.sessionKey && actual.startedAt === expected.startedAt;
}
