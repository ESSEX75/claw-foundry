/** Pins byte-digest compatibility without imposing serialization or normalization policy. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { sha256Hex } from "./index.js";

it("matches known SHA-256 vectors for text and exact bytes", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex(Buffer.from([97, 98, 99])), sha256Hex("abc"));
  assert.notEqual(sha256Hex('{"a":1,"b":2}'), sha256Hex('{"b":2,"a":1}'));
  assert.notEqual(sha256Hex("\u00e9"), sha256Hex("e\u0301"));
});
