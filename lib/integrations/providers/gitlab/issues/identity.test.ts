/** Exercises gitlab issues/identity behavior through the public facade. */

import { describe } from "node:test";
import { registerIssueIdentityTests } from "../../../../testing/index.js";
import { GitLabProvider } from "../index.js";

describe("GitLabProvider issues/identity", () => {
  registerIssueIdentityTests(GitLabProvider);
});
