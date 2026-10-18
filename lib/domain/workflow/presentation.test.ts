/** Verifies completion presentation independently of workflow graph resolution. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { getCompletionEmoji } from "./presentation.js";

it("presents built-in results and retains a stable fallback for custom results", () => {
  assert.equal(getCompletionEmoji("done"), "\u2705");
  assert.equal(getCompletionEmoji("blocked"), "\u{1f6ab}");
  assert.equal(getCompletionEmoji("researched"), "\u{1f4cb}");
});
