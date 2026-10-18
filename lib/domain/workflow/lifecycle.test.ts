/** Verifies ordered lifecycle metadata independently of provider observations. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { ACTION } from "./const.js";
import { resolveIssueClosedAt } from "./lifecycle.js";

it("preserves absent lifecycle intent, stable close time and ordered reopen semantics", () => {
  assert.equal(resolveIssueClosedAt([ACTION.MERGE_PR], "old", "now"), undefined);
  assert.equal(resolveIssueClosedAt([ACTION.CLOSE_ISSUE], "old", "now"), "old");
  assert.equal(resolveIssueClosedAt([ACTION.CLOSE_ISSUE, ACTION.REOPEN_ISSUE], "old", "now"), null);
  assert.equal(resolveIssueClosedAt([ACTION.REOPEN_ISSUE, ACTION.CLOSE_ISSUE], "old", "now"), "now");
  assert.equal(resolveIssueClosedAt([ACTION.CLOSE_ISSUE], null, "now"), "now");
});
