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

it("GitHub fallback searches every page and finds an open request after an older linked closed PR", async () => {
  const closed = { number: 2, title: "old", state: "CLOSED", url: "https://github.com/owner/repo/pull/2" };
  const open = { number: 120, title: "new", state: "OPEN", url: "https://github.com/owner/repo/pull/120" };
  const provider = new GitHubProvider({ repoPath: ".", runCommand: async argv => {
    const endpoint = argv[2]?.split("?")[0];
    if (argv[1] === "repo") return response({ owner: { login: "owner" }, name: "repo" });
    if (endpoint === "graphql") return response([{ data: { repository: { issue: { timelineItems: {
      pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ source: closed }],
    } } } } }]);
    if (endpoint === "repos/:owner/:repo/pulls") return response([
      [{ number: 9, title: "Unrelated #123", body: "", head: { ref: "other" }, html_url: "https://github.com/owner/repo/pull/9" }],
      [{ number: open.number, title: "fix #42", body: "", head: { ref: "feature/42-new" }, html_url: open.url }],
    ]);
    if (argv[1] === "pr") return response(open);
    return response([[]]);
  } });
  assert.equal((await provider.getPrStatus(42)).url, open.url);
});
