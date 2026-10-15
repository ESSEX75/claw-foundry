/** Verifies capacity selection retains unresolved issue references instead of recycling their slots. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { findAvailableWorkerSlot } from "./execution.js";

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
