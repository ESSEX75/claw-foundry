/** Checks GitHub formal review chronology, mergeability and agreement between status and feedback. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { GitHubProvider } from "../index.js";
import { PR_STATE } from "../../contracts/index.js";
import { createPullRequestFixture, createPullRequestTransport } from "../../../../testing/index.js";

it("GitHub uses the latest formal decision per author, including approval and dismissal", async () => {
  for (const [latestState, expected] of [["APPROVED", PR_STATE.APPROVED], ["CHANGES_REQUESTED", PR_STATE.CHANGES_REQUESTED], ["DISMISSED", PR_STATE.OPEN]]) {
    const reviews = [
      { id: 1, user: { login: "reviewer" }, body: "", state: "CHANGES_REQUESTED", submitted_at: "2026-01-01T00:00:00Z" },
      { id: 2, user: { login: "reviewer" }, body: "", state: latestState, submitted_at: "2026-01-02T00:00:00Z" },
    ];
    const provider = new GitHubProvider({ repoPath: ".", runCommand: createPullRequestTransport([createPullRequestFixture(7)], reviews.reverse()) });
    assert.equal((await provider.getPrStatus(42)).state, expected);
  }
});

it("GitHub exposes summary-only feedback without querying a summary reaction endpoint", async () => {
  const calls: string[][] = [];
  const reviews = [{ id: 42, user: { login: "reviewer" }, body: "fix", state: "COMMENTED", submitted_at: "2026-01-01T00:00:00Z" }];
  const provider = new GitHubProvider({ repoPath: ".", runCommand: createPullRequestTransport([createPullRequestFixture(7)], reviews, calls) });
  const status = await provider.getPrStatus(42);
  assert.equal(status.state, PR_STATE.HAS_COMMENTS);
  assert.equal(status.hasCommentFeedback, false);
  assert.equal(status.reviewSummaries?.[0].id, 42);
  assert.ok(!calls.some(argv => /reviews\/\d+\/reactions/.test(argv[2] ?? "")));
});

it("GitHub preserves conflicting and unknown mergeability observations", async () => {
  for (const [value, expected] of [["CONFLICTING", false], ["UNKNOWN", undefined], ["MERGEABLE", true]] as const) {
    const provider = new GitHubProvider({ repoPath: ".", runCommand: createPullRequestTransport([createPullRequestFixture(7, "OPEN", null, value)]) });
    assert.equal((await provider.getPrStatus(42)).mergeable, expected);
  }
});

it("GitHub status and feedback agree on human inline authors while retaining empty and acknowledged context", async () => {
  const comment = { user: { login: "reviewer" }, body: "fix", created_at: "2026-01-01T00:00:00Z", reactions: { eyes: 0 } };
  const bot = { ...comment, id: 1, user: { login: "assistant[bot]" } };
  const empty = { ...comment, id: 2, body: "" };
  const acknowledged = { ...comment, id: 3, reactions: { eyes: 1 } };
  const pending = { ...comment, id: 4 };

  for (const hasPending of [false, true]) {
    const base = createPullRequestTransport([createPullRequestFixture(7)]);
    const rows = hasPending ? [bot, empty, acknowledged, pending] : [bot, empty, acknowledged];
    const runCommand: RunCommand = async (argv, options) => {
      const result = await base(argv, options);
      const endpoint = argv[2]?.split("?")[0];

      return endpoint === "repos/:owner/:repo/pulls/7/comments"
        ? { ...result, stdout: JSON.stringify([rows]) } : result;
    };
    const provider = new GitHubProvider({ repoPath: ".", runCommand });
    const status = await provider.getPrStatus(42);

    assert.equal(status.hasCommentFeedback, hasPending);
    assert.equal(status.state, hasPending ? PR_STATE.HAS_COMMENTS : PR_STATE.OPEN);
    const feedback = await provider.getPrReviewComments(42, createPullRequestFixture(7).url);

    assert.deepEqual(feedback.map(value => [value.id, value.body]),
      hasPending ? [[2, ""], [3, "fix"], [4, "fix"]] : [[2, ""], [3, "fix"]]);
  }
});
