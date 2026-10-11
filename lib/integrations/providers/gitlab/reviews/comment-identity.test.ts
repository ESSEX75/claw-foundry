/** Checks gitlab review identities and their reaction resource routing. */

import assert from "node:assert/strict";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { PR_COMMENT_KIND } from "../../contracts/index.js";
import { GitLabProvider } from "../index.js";

it("GitLab preserves inline identity, deduplicates discussion notes and reacts through MR notes", async () => {
  const calls: string[][] = [];
  const runCommand: RunCommand = async (argv) => {
    calls.push([...argv]);
    const endpoint = argv[2]?.split("?")[0];
    const note = { id: 42, author: { username: "reviewer" }, body: "fix", created_at: "2026-01-01", system: false };
    let data: unknown = [];
    if (endpoint === "projects/:id") data = { id: 1 };
    else if (endpoint?.endsWith("related_merge_requests")) data = [{ iid: 7, project_id: 1, state: "opened", title: "Fix", web_url: "https://gitlab.test/mr/7" }];
    else if (endpoint?.endsWith("discussions")) data = [{ notes: [{ ...note, position: { new_path: "file.ts" } }] }];
    else if (endpoint?.endsWith("notes")) data = [note, { ...note, id: 43 }];
    else if (endpoint?.endsWith("award_emoji")) data = [{ name: "eyes" }];
    return { stdout: JSON.stringify(data), stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
  };
  const provider = new GitLabProvider({ repoPath: ".", runCommand });
  assert.deepEqual((await provider.getPrReviewComments(1)).map(({ id, kind }) => ({ id, kind })), [
    { id: 42, kind: PR_COMMENT_KIND.INLINE }, { id: 43, kind: PR_COMMENT_KIND.CONVERSATION },
  ]);
  assert.equal(await provider.prReviewCommentHasReaction(1, 42, "eyes"), true);
  await provider.reactToPrReviewComment(1, 42, "eyes");
  assert.deepEqual(calls.at(-1), ["glab", "api", "projects/:id/merge_requests/7/notes/42/award_emoji", "--method", "POST", "--field", "name=eyes"]);
});
