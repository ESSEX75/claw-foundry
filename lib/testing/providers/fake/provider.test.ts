/** Verifies fake identity and invocation evidence cannot conceal application regressions. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { TestProvider } from "./provider.js";

it("allocates distinct comment identities even when the clock does not advance", async t => {
  t.mock.method(Date, "now", () => 1000);
  const provider = new TestProvider();
  const ids = await Promise.all(Array.from({ length: 5 }, () => provider.addComment(1, "comment")));

  assert.equal(new Set(ids).size, 5);
  assert.deepEqual(provider.comments.get(1)?.map(comment => comment.id), ids);
});

it("retains invocation payloads after caller mutations and records review observations", async () => {
  const provider = new TestProvider();
  const input = { title: "Original", body: "Body", labels: ["ready"], assignees: [] };

  await provider.createIssue(input);
  input.title = "Changed";
  input.labels.push("later");
  assert.equal(provider.callsTo("createIssue")[0].args.title, "Original");
  assert.deepEqual(provider.callsTo("createIssue")[0].args.labels, ["ready"]);
  await provider.getPrReviewComments(1, "https://example.com/pull/2");
  assert.equal(provider.callsTo("getPrReviewComments")[0].args.prUrl, "https://example.com/pull/2");
});
