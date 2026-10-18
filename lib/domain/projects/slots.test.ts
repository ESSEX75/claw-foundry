/**
 * Verifies reconciliation of configured worker-slot levels.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptySlot, reconcileSlots, releasedWorkerSlot, sameSlotReservation, slotOwnsWorkerRun, type RoleWorkerState } from "./index.js";

describe("reconcileSlots", () => {
  it("preserves inactive references and delivery evidence until explicit release", () => {
    const referenced = { ...emptySlot(), issueId: 42, sessionKey: "reusable" };
    const unresolved = { ...emptySlot(), delivery: {
      status: "unknown" as const, recordedAt: "now", reason: "unconfirmed",
    } };

    for (const slot of [referenced, unresolved]) {
      const roleWorker: RoleWorkerState = { levels: { junior: [slot, emptySlot()] } };

      assert.equal(reconcileSlots(roleWorker, { junior: 0 }), true);
      assert.deepEqual(roleWorker.levels.junior, [slot]);
      assert.equal(reconcileSlots(roleWorker, {}), false);
      assert.deepEqual(roleWorker.levels.junior, [slot]);
      roleWorker.levels.junior = [releasedWorkerSlot(slot, slot.issueId)];
      assert.equal(reconcileSlots(roleWorker, {}), true);
      assert.deepEqual(roleWorker.levels, {});
      assert.equal(slot.sessionKey, referenced === slot ? "reusable" : null);
    }
  });

  it("reports zero-capacity level creation once and tracks capacity changes", () => {
    const roleWorker: RoleWorkerState = { levels: {} };

    assert.equal(reconcileSlots(roleWorker, { expert: 0 }), true);
    assert.deepEqual(roleWorker.levels, { expert: [] });
    assert.equal(reconcileSlots(roleWorker, { expert: 0 }), false);
    assert.equal(reconcileSlots(roleWorker, { expert: 2 }), true);
    assert.equal(roleWorker.levels.expert?.length, 2);
    assert.equal(reconcileSlots(roleWorker, { expert: 0 }), true);
    assert.deepEqual(roleWorker.levels, { expert: [] });
    assert.equal(reconcileSlots(roleWorker, { expert: 0 }), false);
  });

  it("removes an unconfigured level when all of its slots are inactive", () => {
    const roleWorker: RoleWorkerState = {
      levels: { legacy: [emptySlot()] },
    };

    assert.equal(reconcileSlots(roleWorker, {}), true);
    assert.deepEqual(roleWorker.levels, {});
  });

  it("retains an unconfigured level while it has an active slot", () => {
    const activeSlot = emptySlot();
    activeSlot.active = true;
    activeSlot.issueId = 42;
    const roleWorker: RoleWorkerState = {
      levels: { legacy: [activeSlot] },
    };

    assert.equal(reconcileSlots(roleWorker, {}), false);
    assert.deepEqual(roleWorker.levels, { legacy: [activeSlot] });
  });

  it("removes a retained level after its active work finishes", () => {
    const activeSlot = emptySlot();
    activeSlot.active = true;
    const roleWorker: RoleWorkerState = {
      levels: { legacy: [activeSlot] },
    };

    reconcileSlots(roleWorker, {});
    activeSlot.active = false;

    assert.equal(reconcileSlots(roleWorker, {}), true);
    assert.deepEqual(roleWorker.levels, {});
  });
});

it("fences replacement runs and delivery tokens while releasing all submission evidence", () => {
  const slot = { ...emptySlot(), active: true, issueId: 7, sessionKey: "worker", startTime: "original",
    delivery: { operationId: "turn-1", status: "unknown" as const, recordedAt: "original", reason: "pending" } };

  assert.equal(slotOwnsWorkerRun(slot, 7, { sessionKey: "worker", startedAt: "original" }), true);
  assert.equal(slotOwnsWorkerRun(slot, 8, { sessionKey: "worker", startedAt: "original" }), false);
  assert.equal(slotOwnsWorkerRun(slot, 7, { sessionKey: "worker", startedAt: "replacement" }), false);
  assert.equal(sameSlotReservation({ ...slot, delivery: { ...slot.delivery, operationId: "turn-2" } }, slot), false);
  assert.equal(sameSlotReservation({ ...slot, active: false }, slot), false);
  const released = releasedWorkerSlot(slot, 7);

  assert.equal(released.delivery, undefined);
  assert.equal(released.sessionKey, "worker");
  assert.equal(released.lastIssueId, 7);
  assert.equal(released.issueId, null);
});
