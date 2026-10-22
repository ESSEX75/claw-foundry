/** Reusable provider composition scenarios registered from tests beside concrete provider owners. */

import assert from "node:assert/strict";
import { it } from "node:test";

import type { ProviderAdapterOptions } from "../../../integrations/index.js";
import { GitHubProvider } from "../../../integrations/index.js";
import { completedCommand } from "../../commands/index.js";
import type { ScenarioProvider } from "./types.js";

/** Register facade ownership checks against mutation of caller dependencies.
 * @param Provider - Concrete facade whose public behavior is exercised.
 */
export function registerProviderCompositionTests(Provider: ScenarioProvider): void {
  it(`${Provider.name} retains its repository and transport snapshot after caller options change`, async () => {
    let originalCalls = 0;
    let replacementCalls = 0;
    const options: ProviderAdapterOptions = { repoPath: "original-repo", runCommand: async (_argv, commandOptions) => {
      originalCalls++;
      assert.equal(typeof commandOptions === "number" ? undefined : commandOptions.cwd, "original-repo");
      const stdout = JSON.stringify(Provider === GitHubProvider
        ? { number: 1, title: "Original", body: "", labels: [], state: "OPEN", url: "https://github.test/team/repo/issues/1" }
        : { iid: 1, title: "Original", description: "", labels: [], state: "opened", web_url: "https://gitlab.test/team/repo/issues/1" });

      return completedCommand(stdout);
    } };
    const provider = new Provider(options);

    options.repoPath = "replacement-repo";
    options.runCommand = async () => { replacementCalls++; throw new Error("replacement must not execute"); };

    assert.equal((await provider.getIssue(1)).title, "Original");
    assert.equal(originalCalls, 1);
    assert.equal(replacementCalls, 0);
  });
}
