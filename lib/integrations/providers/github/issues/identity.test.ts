/** Exercises github issues/identity behavior through the public facade. */

import { describe } from "node:test";
import { registerIssueIdentityTests } from "../../../../testing/index.js";
import { GitHubProvider } from "../index.js";

describe("GitHubProvider issues/identity", () => {
  registerIssueIdentityTests(GitHubProvider);
});
