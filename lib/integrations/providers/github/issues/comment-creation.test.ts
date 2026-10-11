/** Exercises github issues/comment-creation behavior through the public facade. */

import { describe } from "node:test";
import { registerCommentCreationTests } from "../../../../testing/index.js";
import { GitHubProvider } from "../index.js";

describe("GitHubProvider issues/comment-creation", () => {
  registerCommentCreationTests(GitHubProvider);
});
