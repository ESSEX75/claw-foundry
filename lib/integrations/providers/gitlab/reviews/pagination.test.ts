/** Checks complete provider pagination and filters foreign or unrelated resources. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { PR_COMMENT_KIND } from "../../contracts/index.js";
import { GitLabProvider } from "../index.js";

/** Serialize one clean provider CLI response without bypassing transport validation.
 * @param data - Complete paginated or scalar fixture payload.
 */
function response(data: unknown): Awaited<ReturnType<RunCommand>> {
  return { stdout: JSON.stringify(data), stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}

it("GitLab decodes later discussion pages, keeps inline kind without position and filters foreign project IIDs", async () => {
  const note = { id: 1, author: { username: "reviewer" }, body: "fix", created_at: "2026-01-01", system: false };
  const mr = { iid: 3, project_id: 1, title: "Fix", state: "opened", web_url: "https://gitlab.test/group/repo/-/merge_requests/3" };
  const calls: string[][] = [];
  const runCommand: RunCommand = async argv => {
    calls.push([...argv]);
    const endpoint = argv[2]?.split("?")[0];
    if (endpoint === "projects/:id") return response({ id: 1 });
    if (endpoint?.endsWith("related_merge_requests")) return { ...response([]), stdout: JSON.stringify([mr]) + JSON.stringify([{ ...mr, iid: 99, project_id: 2 }]) };
    if (endpoint?.endsWith("discussions")) return { ...response([]), stdout: JSON.stringify([{ notes: [{ ...note, type: "DiffNote", position: null }] }])
      + JSON.stringify([{ notes: [{ ...note, id: 2, type: "DiscussionNote" }] }]) };
    if (endpoint?.endsWith("notes")) return response([note, { ...note, id: 2 }]);
    return response([]);
  };
  const feedback = await new GitLabProvider({ repoPath: ".", runCommand }).getPrReviewComments(42);
  assert.deepEqual(feedback.map(comment => [comment.id, comment.kind]), [[1, PR_COMMENT_KIND.INLINE], [2, PR_COMMENT_KIND.CONVERSATION]]);
  assert.ok(calls.filter(argv => argv[2]?.includes("merge_requests/")).every(argv => argv[2].includes("merge_requests/3/")));
});
