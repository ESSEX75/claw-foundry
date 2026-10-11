/** Checks complete provider pagination and filters foreign or unrelated resources. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { GitHubProvider } from "../index.js";
import { isProviderIssueLookupError } from "../../errors/index.js";

/** Serialize one clean provider CLI response without bypassing transport validation.
 * @param data - Complete paginated or scalar fixture payload.
 */
function response(data: unknown): Awaited<ReturnType<RunCommand>> {
  return { stdout: JSON.stringify(data), stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}

it("GitHub rejects incomplete cursor pagination rather than accepting a prefix", async () => {
  const provider = new GitHubProvider({ repoPath: ".", runCommand: async argv => argv[1] === "repo"
    ? response({ owner: { login: "owner" }, name: "repo" }) : response([{ data: { repository: { issue: { timelineItems: {
      pageInfo: { hasNextPage: true, endCursor: "more" }, nodes: [],
    } } } } }]) });
  await assert.rejects(provider.getPrStatus(42), isProviderIssueLookupError);
});
