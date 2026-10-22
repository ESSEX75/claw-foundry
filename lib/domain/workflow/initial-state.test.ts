/** Verifies configured initial-state lookup independently of routing policies. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { DEFAULT_WORKFLOW, STATE_TYPE, getInitialStateLabel, type WorkflowConfig } from "./index.js";

it("selects built-in and custom initial hold labels", () => {
  const workflow: WorkflowConfig = { initial: "backlog", states: {
    backlog: { type: STATE_TYPE.HOLD, label: "Backlog", color: "#aaaaaa" },
  } };
  assert.equal(getInitialStateLabel(DEFAULT_WORKFLOW), "Planning");
  assert.equal(getInitialStateLabel(workflow), "Backlog");
});
