/** Exercises gitlab issues/comment-creation behavior through the public facade. */

import { describe } from "node:test";
import { registerCommentCreationTests } from "../../../../testing/index.js";
import { GitLabProvider } from "../index.js";

describe("GitLabProvider issues/comment-creation", () => {
  registerCommentCreationTests(GitLabProvider);
});
