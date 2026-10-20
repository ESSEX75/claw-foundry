/** Pins explicit duration grammar, zero handling and safe millisecond boundaries. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { DURATION_PATTERN, parseDuration } from "./index.js";

it("converts supported integral units and preserves the safe boundary", () => {
  for (const [value, expected] of [["0d", 0], ["1ms", 1], ["2s", 2000], ["3m", 180000], ["4h", 14400000], ["5d", 432000000]] satisfies [string, number][]) {
    assert.equal(DURATION_PATTERN.test(value), true);
    assert.equal(parseDuration(value), expected);
  }
  assert.equal(parseDuration("9007199254740991ms"), Number.MAX_SAFE_INTEGER);
});

it("rejects malformed durations and numeric overflow without trimming or defaults", () => {
  for (const value of ["", "1", "-1s", "1.5h", "1w", " 1s", "1s "]) {
    assert.equal(DURATION_PATTERN.test(value), false);
    assert.throws(() => parseDuration(value), /Invalid duration/);
  }
  assert.throws(() => parseDuration("9007199254740992ms"), /safe range/);
  assert.throws(() => parseDuration("999999999999999999999999999999999999999d"), /safe range/);
});
