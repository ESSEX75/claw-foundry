/** Verifies capacity selection retains unresolved issue references instead of recycling their slots. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { findAvailableWorkerSlot } from "./execution.js";
import { emptySlot } from "./slots.js";

it("selects only unreserved capacity, including slots not yet materialized", () => {
  const worker = { levels: { junior: [
    { active: true, issueId: 1, sessionKey: "busy", startTime: null },
    { active: false, issueId: 2, sessionKey: "unreconciled", startTime: null },
  ] } };
  assert.equal(findAvailableWorkerSlot(worker, "junior", 2), null);
  assert.equal(findAvailableWorkerSlot(worker, "junior", 3), 2);
  assert.equal(findAvailableWorkerSlot(worker, "other", 1), 0);
  assert.equal(findAvailableWorkerSlot(worker, "other", 0), null);
});

it("skips unresolved delivery markers and retains reusable session metadata", () => {
  const worker = { levels: { custom: [
    { ...emptySlot(), delivery: { status: "unknown" as const, recordedAt: "now", reason: "unconfirmed" } },
    { ...emptySlot(), sessionKey: "reusable", name: "Ada" },
  ] } };

  assert.equal(findAvailableWorkerSlot(worker, "custom", 2), 1);
  assert.equal(findAvailableWorkerSlot(worker, "custom", 1), null);
  for (const capacity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(findAvailableWorkerSlot(worker, "custom", capacity), null);
  }
  assert.equal(worker.levels.custom[1]?.sessionKey, "reusable");
});
