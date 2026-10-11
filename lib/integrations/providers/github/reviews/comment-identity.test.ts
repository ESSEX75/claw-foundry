/** Checks github review identities and their reaction resource routing. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { PR_COMMENT_KIND } from "../../contracts/index.js";
import { GitHubProvider } from "../index.js";

it("GitHub keeps review, inline and conversation IDs separate and uses the inline reaction endpoint", async () => {
  const calls: string[][] = [];
  const runCommand: RunCommand = async (argv) => {
    calls.push([...argv]);
    const endpoint = argv[2]?.split("?")[0];
    const comment = { id: 42, user: { login: "reviewer" }, body: "fix", state: "COMMENTED", created_at: "2026-01-01", submitted_at: "2026-01-01" };
    let data: unknown = [];
    if (argv[1] === "repo") data = { owner: { login: "owner" }, name: "repo" };
    else if (endpoint === "graphql") data = [{ data: { repository: { issue: { timelineItems: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ source: { number: 7, title: "Fix", body: "", headRefName: "feature/1-fix", url: "https://github.com/owner/repo/pull/7", state: "OPEN" } }] } } } } }];
    else if (argv[1] === "pr") data = [{ number: 7, title: "Fix #1", body: "", headRefName: "feature/1-fix" }];
    else if (endpoint?.endsWith("/reactions")) data = [{ content: "eyes" }];
    else if (argv[1] === "api") data = [comment];
    return { stdout: JSON.stringify(argv.includes("--slurp") && endpoint !== "graphql" ? [data] : data), stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
  };
  const provider = new GitHubProvider({ repoPath: ".", runCommand });
  const comments = await provider.getPrReviewComments(1);
  assert.deepEqual(comments.map(({ kind, id }) => ({ kind, id })), [
    { kind: PR_COMMENT_KIND.REVIEW, id: 42 },
    { kind: PR_COMMENT_KIND.INLINE, id: 42 },
    { kind: PR_COMMENT_KIND.CONVERSATION, id: 42 },
  ]);
  assert.equal(await provider.prReviewCommentHasReaction(1, 42, "eyes"), true);
  await provider.reactToPrReviewComment(1, 42, "eyes");
  assert.deepEqual(calls.slice(-2), [
    ["gh", "api", "repos/:owner/:repo/pulls/comments/42/reactions?per_page=100", "--paginate", "--slurp"],
    ["gh", "api", "repos/:owner/:repo/pulls/comments/42/reactions", "--method", "POST", "--field", "content=eyes"],
  ]);
});
