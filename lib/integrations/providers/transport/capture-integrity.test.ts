/** Rejects clipped or failed output capture even when surviving response text appears valid. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../context.js";
import { runProviderCommand } from "./index.js";
import { normalizeProviderFailure } from "../errors/index.js";
import { PROVIDER_OPERATION_ERROR } from "../errors/index.js";

/** Clean process evidence reused to vary untrusted provider response content.
 * @param stdout - External command JSON to deliver to the adapter.
 */
function completed(stdout: string): Awaited<ReturnType<RunCommand>> {
  return { stdout, stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}

it("rejects clipped valid JSON and clipped 404 diagnostics as an unknown submitted command outcome", async () => {
  for (const result of [
    { ...completed("[]"), stdoutTruncatedBytes: 10 },
    { ...completed(""), code: 1, stderr: "HTTP 404 Not Found", stderrTruncatedBytes: 10 },
    { ...completed("[]"), outputErrorStream: "stdout" },
  ] satisfies Awaited<ReturnType<RunCommand>>[]) {
    let calls = 0;
    await assert.rejects(runProviderCommand(async () => { calls++; return result; }, ["gh", "api", "issues"], "."), error => {
      const failure = normalizeProviderFailure(error);
      return failure.code === PROVIDER_OPERATION_ERROR.TRANSIENT && failure.outcomeUnknown;
    });
    assert.equal(calls, 1);
  }
});
