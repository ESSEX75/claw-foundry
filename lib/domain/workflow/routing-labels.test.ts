/** Verifies pure policy label projections and configured initial-state lookup. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REVIEW_POLICY, STATE_TYPE } from "./const.js";
import { DEFAULT_WORKFLOW } from "./defaults.js";
import { resolveReviewRouting } from "./labels.js";
import { getInitialStateLabel } from "./queries.js";
import type { WorkflowConfig } from "./types.js";

describe("workflow routing labels", () => {
  it("projects each supported review policy without interpreting provider observations", () => {
    assert.equal(resolveReviewRouting(REVIEW_POLICY.HUMAN), "review:human");
    assert.equal(resolveReviewRouting(REVIEW_POLICY.AGENT), "review:agent");
    assert.equal(resolveReviewRouting(REVIEW_POLICY.SKIP), "review:skip");
  });
  it("selects configured initial labels for built-in and custom hold states", () => {
    const custom: WorkflowConfig = { initial: "backlog", states: {
      backlog: { type: STATE_TYPE.HOLD, label: "Backlog", color: "#aaaaaa" },
    } };
    assert.equal(getInitialStateLabel(DEFAULT_WORKFLOW), "Planning");
    assert.equal(getInitialStateLabel(custom), "Backlog");
  });
});
