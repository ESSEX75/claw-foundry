/** Verifies canonical label projection for every saved routing policy. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { REVIEW_POLICY, TEST_POLICY, resolveReviewRouting, resolveTestRouting } from "./index.js";

it("projects every supported policy without provider observations", () => {
  assert.equal(resolveReviewRouting(REVIEW_POLICY.HUMAN), "review:human");
  assert.equal(resolveReviewRouting(REVIEW_POLICY.AGENT), "review:agent");
  assert.equal(resolveReviewRouting(REVIEW_POLICY.SKIP), "review:skip");
  assert.equal(resolveTestRouting(TEST_POLICY.SKIP), "test:skip");
  assert.equal(resolveTestRouting(TEST_POLICY.AGENT), "test:agent");
});
