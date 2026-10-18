/** Verifies built-in completion membership without restricting configured custom results. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { COMPLETION_RESULT, DEFAULT_RESULT_EMOJI, getCompletionEmoji, isBuiltInCompletionResult } from "./index.js";

it("recognizes every built-in result and presents unknown results with the fallback emoji", () => {
  for (const result of Object.values(COMPLETION_RESULT)) assert.equal(isBuiltInCompletionResult(result), true);
  for (const value of [null, undefined, 1, {}, "researched"]) assert.equal(isBuiltInCompletionResult(value), false);
  assert.equal(getCompletionEmoji("researched"), DEFAULT_RESULT_EMOJI);
});
