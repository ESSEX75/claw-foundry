/** Ensures local decoding errors do not impersonate provider HTTP rejection evidence. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { z } from "zod";
import { normalizeProviderFailure } from "./index.js";
import { PROVIDER_OPERATION_ERROR } from "./index.js";

it("does not interpret HTTP-like numbers in local schema or JSON decoding errors as provider rejections", () => {
  let schemaError: unknown;
  try { z.object({ "404": z.number() }).parse({}); } catch (error) { schemaError = error; }
  for (const error of [schemaError, new SyntaxError("Malformed JSON near HTTP 401")]) {
    assert.deepEqual(normalizeProviderFailure(error), { code: PROVIDER_OPERATION_ERROR.UNKNOWN, retryable: false, outcomeUnknown: true });
  }
});
