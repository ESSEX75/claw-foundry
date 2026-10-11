/** Exercises github pull-requests/selection behavior through the public facade. */

import { describe } from "node:test";
import { registerPullRequestSelectionTests } from "../../../../testing/index.js";
import { GitHubProvider } from "../index.js";

describe("GitHubProvider pull-requests/selection", () => {
  registerPullRequestSelectionTests(GitHubProvider);
});
