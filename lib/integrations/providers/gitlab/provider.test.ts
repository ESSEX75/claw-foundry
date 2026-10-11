/** Exercises gitlab provider behavior through the public facade. */

import { describe } from "node:test";
import { registerProviderCompositionTests } from "../../../testing/index.js";
import { GitLabProvider } from "./provider.js";

describe("GitLabProvider provider", () => {
  registerProviderCompositionTests(GitLabProvider);
});
