/** Verifies workspace fixtures cannot mutate shared workflow defaults or caller configuration. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { DEFAULT_WORKFLOW } from "../../domain/index.js";
import { createTestHarness } from "./harness.js";

it("gives each harness an independent workflow snapshot", async t => {
  const before = structuredClone(DEFAULT_WORKFLOW);
  const first = await createTestHarness();

  t.after(() => first.cleanup());
  first.workflow.initial = "changed";
  const second = await createTestHarness();

  t.after(() => second.cleanup());
  assert.equal(second.workflow.initial, before.initial);
  assert.deepEqual(DEFAULT_WORKFLOW, before);
});
