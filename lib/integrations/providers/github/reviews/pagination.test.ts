/** Checks complete provider pagination and filters foreign or unrelated resources. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { PR_COMMENT_KIND } from "../../contracts/index.js";
import { GitHubProvider } from "../index.js";
import { PR_STATE } from "../../contracts/index.js";

/** Serialize one clean provider CLI response without bypassing transport validation.
 * @param data - Complete paginated or scalar fixture payload.
 */
function response(data: unknown): Awaited<ReturnType<RunCommand>> {
  return { stdout: JSON.stringify(data), stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}

it("GitHub reads later timeline and review pages and excludes cross-repository references", async () => {
  const calls: string[][] = [];
  const pr = { number: 21, title: "Fix", state: "OPEN", url: "https://github.com/owner/repo/pull/21" };
  const first = { id: 8, user: { login: "reviewer" }, body: "obsolete request", state: "CHANGES_REQUESTED", submitted_at: "2026-01-01" };
  const last = { ...first, id: 9, body: "current approval", state: "APPROVED", submitted_at: "2026-01-02" };
  const inline = { id: 9, user: { login: "reviewer" }, body: "inline", created_at: "2026-01-01" };
  const runCommand: RunCommand = async argv => {
    calls.push([...argv]);
    const endpoint = argv[2]?.split("?")[0];
    if (argv[1] === "repo") return response({ owner: { login: "owner" }, name: "repo" });
    if (endpoint === "graphql") return response([
      { data: { repository: { issue: { timelineItems: { pageInfo: { hasNextPage: true, endCursor: "cursor" },
        nodes: [{ source: { ...pr, number: 99, url: "https://github.com/foreign/repo/pull/99" } }] } } } } },
      { data: { repository: { issue: { timelineItems: { pageInfo: { hasNextPage: false, endCursor: "last" }, nodes: [{ source: pr }] } } } } },
    ]);
    if (endpoint?.endsWith("/reviews")) return response([[first], [last]]);
    if (endpoint?.includes("/pulls/") && endpoint.endsWith("/comments")) return response([[inline], [{ ...inline, id: 10 }]]);
    return response([[]]);
  };
  const provider = new GitHubProvider({ repoPath: ".", runCommand });
  const status = await provider.getPrStatus(42);
  assert.equal(status.url, pr.url);
  assert.equal(status.state, PR_STATE.APPROVED);
  const feedback = await provider.getPrReviewComments(42);
  assert.ok(!feedback.some(comment => comment.body === first.body));
  assert.equal(feedback.filter(comment => comment.kind === PR_COMMENT_KIND.INLINE).length, 2);
  assert.equal(feedback.filter(comment => comment.kind === PR_COMMENT_KIND.REVIEW).length, 1);
  assert.ok(calls.some(argv => argv.includes("--paginate") && argv.includes("--slurp") && argv.some(arg => arg.includes("after: $endCursor"))));
});
