/** Exercises github provider behavior through the public facade. */

import { describe } from "node:test";
import { registerProviderCompositionTests } from "../../../testing/index.js";
import { GitHubProvider } from "./provider.js";

describe("GitHubProvider provider", () => {
  registerProviderCompositionTests(GitHubProvider);
});
