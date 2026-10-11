/** Checks complete provider pagination and filters foreign or unrelated resources. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { GitHubProvider } from "../index.js";

/** Serialize one clean provider CLI response without bypassing transport validation.
 * @param data - Complete paginated or scalar fixture payload.
 */
function response(data: unknown): Awaited<ReturnType<RunCommand>> {
  return { stdout: JSON.stringify(data), stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}

it("GitHub complete issue pages exclude REST pull-request entries and preserve later issues", async () => {
  const issue = { number: 1, title: "Issue", body: "", labels: [], state: "open", html_url: "https://github.com/owner/repo/issues/1" };
  const provider = new GitHubProvider({ repoPath: ".", runCommand: async () => response([
    [issue], [{ ...issue, number: 2, pull_request: {} }, { ...issue, number: 3 }],
  ]) });
  assert.deepEqual((await provider.listIssues()).map(value => value.iid), [1, 3]);
});
