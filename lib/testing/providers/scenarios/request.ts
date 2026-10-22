/** Reusable provider request scenarios registered from tests beside concrete provider owners. */

import assert from "node:assert/strict";
import { it } from "node:test";

import type { RunCommand } from "../../../context.js";
import { GitHubProvider } from "../../../integrations/index.js";
import { PR_STATE } from "../../../integrations/index.js";
import { completedCommand } from "../../commands/index.js";
import type { ScenarioProvider } from "./types.js";

/** Construct complete GitHub PR observations without overriding private adapter methods.
 * @param number - Provider PR identity.
 * @param state - Provider lifecycle state.
 * @param reviewDecision - Aggregate server review decision.
 * @param mergeable - Server mergeability observation.
 */
export function createPullRequestFixture(number: number, state = "OPEN", reviewDecision: string | null = null, mergeable = "MERGEABLE") {
  return { number, state, reviewDecision, mergeable, title: `Fix #42 (${number})`, body: "", headRefName: `feature/42-${number}`,
    url: `https://github.com/owner/repo/pull/${number}`, mergedAt: state === "MERGED" ? "2026-01-01T00:00:00Z" : null };
}

/** Model complete provider responses, recording exact targets for cross-capability agreement.
 * @param rows - GitHub-shaped candidates converted to the selected provider format.
 * @param reviews - Summary pages supplied to GitHub review inspection.
 * @param calls - Captured command argument vectors.
 */
export function createPullRequestTransport(rows: ReturnType<typeof createPullRequestFixture>[], reviews: unknown[] = [], calls: string[][] = []): RunCommand {
  return async argv => {
    calls.push([...argv]);
    const endpoint = argv[2]?.split("?")[0];
    let data: unknown = [];
    let stdout: string | undefined;

    if (argv[1] === "repo") data = { owner: { login: "owner" }, name: "repo" };
    else if (endpoint === "graphql") data = [{ data: { repository: { issue: { timelineItems: {
      pageInfo: { hasNextPage: false, endCursor: null }, nodes: rows.map(source => ({ source })),
    } } } } }];
    else if (endpoint === "projects/:id") data = { id: 1 };
    else if (endpoint?.endsWith("related_merge_requests")) data = rows.map(pr => ({ iid: pr.number, project_id: 1, title: pr.title,
      description: pr.body, web_url: pr.url, state: pr.state === "OPEN" ? "opened" : pr.state.toLowerCase(), source_branch: pr.headRefName, merged_at: pr.mergedAt }));
    else if (endpoint?.endsWith("/reviews")) data = reviews;
    else if (endpoint?.endsWith("/approvals")) data = { approved_by: [], approvals_left: 1 };
    else if (/merge_requests\/\d+$/.test(endpoint ?? "")) data = { detailed_merge_status: "mergeable" };
    else if (argv[1] === "pr" || argv[1] === "mr") stdout = argv[2] === "diff" ? `diff ${argv[3]}` : "";
    const paginated = argv.includes("--slurp") && endpoint !== "graphql";

    return completedCommand(stdout ?? JSON.stringify(paginated ? [data] : data));
  };
}

/** Register consistent PR/MR selection across status, feedback, diff, and merge.
 * @param Provider - Concrete facade whose public behavior is exercised.
 */
export function registerPullRequestSelectionTests(Provider: ScenarioProvider): void {
  it(`${Provider.name} distinguishes missing, closed and merged PRs`, async () => {
    for (const state of [undefined, "CLOSED", "MERGED"]) {
      const provider = new Provider({ repoPath: ".", runCommand: createPullRequestTransport(state ? [createPullRequestFixture(7, state)] : []) });
      const status = await provider.getPrStatus(42);

      assert.equal(status.state, state === "MERGED" ? PR_STATE.MERGED : PR_STATE.CLOSED);
      assert.equal(status.url, state ? createPullRequestFixture(7).url : null);
    }
  });

  it(`${Provider.name} selects the same newest open request for status, diff, merge and feedback`, async () => {
    const calls: string[][] = [];
    const candidates = [createPullRequestFixture(2), createPullRequestFixture(9),
      createPullRequestFixture(5, "MERGED"), createPullRequestFixture(12, "CLOSED")];
    const provider = new Provider({ repoPath: ".", runCommand: createPullRequestTransport(candidates, [], calls) });

    assert.equal((await provider.getPrStatus(42)).url, createPullRequestFixture(9).url);
    assert.equal(await provider.getPrDiff(42), "diff 9");
    await provider.getPrReviewComments(42);
    await provider.mergePr(42);
    const merge = calls.find(argv => (argv[1] === "pr" || argv[1] === "mr") && argv[2] === "merge");

    assert.equal(merge?.[3], Provider === GitHubProvider ? createPullRequestFixture(9).url : "9");
    const feedback = calls.filter(argv => /\/(?:pulls|merge_requests)\/\d+\/(?:reviews|comments|discussions|notes)/.test(argv[2] ?? ""));

    assert.ok(feedback.length > 0);
    assert.ok(feedback.every(argv => argv[2].includes("/9/")));
  });

  it(`${Provider.name} uses the same newest merged request for status and merged URL`, async () => {
    const candidates = [createPullRequestFixture(2, "MERGED"), createPullRequestFixture(8, "MERGED"), createPullRequestFixture(9, "CLOSED")];
    const provider = new Provider({ repoPath: ".", runCommand: createPullRequestTransport(candidates) });

    assert.equal((await provider.getPrStatus(42)).url, createPullRequestFixture(8).url);
    assert.equal(await provider.getMergedMRUrl(42), createPullRequestFixture(8).url);
  });

  it(`${Provider.name} honors an observed target and never redirects a missing target to a newer request`, async () => {
    const calls: string[][] = [];
    const provider = new Provider({ repoPath: ".", runCommand: createPullRequestTransport([createPullRequestFixture(2), createPullRequestFixture(9)], [], calls) });

    assert.equal((await provider.getPrStatus(42, createPullRequestFixture(2).url)).url, createPullRequestFixture(2).url);
    assert.equal(await provider.getPrDiff(42, createPullRequestFixture(2).url), "diff 2");
    await provider.mergePr(42, createPullRequestFixture(2).url);
    const merge = calls.find(argv => (argv[1] === "pr" || argv[1] === "mr") && argv[2] === "merge");

    assert.equal(merge?.[3], Provider === GitHubProvider ? createPullRequestFixture(2).url : "2");
    const count = calls.filter(argv => (argv[1] === "pr" || argv[1] === "mr") && argv[2] === "merge").length;

    await assert.rejects(provider.mergePr(42, createPullRequestFixture(3).url), /no longer available/);
    await assert.rejects(provider.getPrReviewComments(42, createPullRequestFixture(3).url), /no longer available/);
    assert.equal(calls.filter(argv => (argv[1] === "pr" || argv[1] === "mr") && argv[2] === "merge").length, count);
  });
}
