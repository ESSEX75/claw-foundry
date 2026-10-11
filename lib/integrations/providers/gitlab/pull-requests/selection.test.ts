/** Exercises gitlab pull-requests/selection behavior through the public facade. */

import { describe } from "node:test";
import { registerPullRequestSelectionTests } from "../../../../testing/index.js";
import { GitLabProvider } from "../index.js";

describe("GitLabProvider pull-requests/selection", () => {
  registerPullRequestSelectionTests(GitLabProvider);
});
