/** Verifies shared diagnostics preserve thrown values while coded evidence remains strict. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { getErrorMessage, hasErrorCode } from "./index.js";

it("preserves Error messages and ordinary conversion of other thrown values", () => {
  assert.equal(getErrorMessage(new Error("failure")), "failure");
  assert.equal(getErrorMessage(new Error("")), "");
  assert.equal(getErrorMessage("failure"), "failure");
  assert.equal(getErrorMessage(null), "null");
  assert.equal(getErrorMessage(undefined), "undefined");
  assert.equal(getErrorMessage(0), "0");
});

it("narrows only actual Errors with string codes, without adopting causes or plain objects", () => {
  const missing = Object.assign(new Error("missing"), { code: "ENOENT" });

  assert.equal(hasErrorCode(missing), true);
  assert.equal(hasErrorCode(missing, "ENOENT"), true);
  assert.equal(hasErrorCode(missing, "EACCES"), false);
  assert.equal(hasErrorCode({ code: "ENOENT" }), false);
  assert.equal(hasErrorCode(Object.assign(new Error("bad code"), { code: 404 })), false);
  assert.equal(hasErrorCode(new Error("wrapper", { cause: missing })), false);
  assert.equal(hasErrorCode(null), false);
});
