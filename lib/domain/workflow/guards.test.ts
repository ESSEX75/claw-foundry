/** Verifies built-in completion membership without restricting configured custom results. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { COMPLETION_RESULT, isBuiltInCompletionResult } from "./index.js";

it("recognizes built-in results without accepting arbitrary runtime values", () => {
  for (const result of Object.values(COMPLETION_RESULT)) assert.equal(isBuiltInCompletionResult(result), true);
  for (const value of [null, undefined, 1, {}, "researched"]) assert.equal(isBuiltInCompletionResult(value), false);
});
