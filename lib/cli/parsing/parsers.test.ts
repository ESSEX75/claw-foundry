/** Verifies strict terminal identifiers, selections and explicit execution modes. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseIssueId, parseIssueSelection, parseSelection, requireExclusiveMode } from "./parsers.js";

describe("CLI argument parsing", () => {
  it("rejects the entire issue selection when any decimal ID is invalid", () => {
    for (const value of ["", " ", "12,typo", "12,", ",12", "0", "-1", "1.5", "9007199254740993", "1e2", "0x10"]) {
      assert.throws(() => parseIssueSelection(value), /Invalid issue ID|non-empty comma-separated list/, value);
    }

    assert.deepEqual(parseIssueSelection(" 12, 34 "), [12, 34]);
    assert.equal(parseIssueSelection(undefined), undefined);
    assert.equal(parseIssueId("9007199254740991"), Number.MAX_SAFE_INTEGER);
  });

  it("keeps explicit state selections distinct from omitted filters", () => {
    for (const value of ["", " ", "queued,", "queued,,custom"]) {
      assert.throws(() => parseSelection(value, "--state"), /--state/);
    }

    assert.deepEqual(parseSelection(" queued, custom ", "--state"), ["queued", "custom"]);
    assert.equal(parseSelection(undefined, "--state"), undefined);
  });

  it("requires exactly one mode, whether the other flag is false or omitted", () => {
    assert.throws(() => requireExclusiveMode(undefined, undefined));
    assert.throws(() => requireExclusiveMode(false, false));
    assert.throws(() => requireExclusiveMode(true, true));
    requireExclusiveMode(true, undefined);
    requireExclusiveMode(undefined, true);
  });
});
