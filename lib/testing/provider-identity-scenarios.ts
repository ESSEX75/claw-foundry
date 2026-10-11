/** Reusable provider identity scenarios registered from tests beside concrete provider owners. */

import assert from "node:assert/strict";
import { it } from "node:test";

import type { RunCommand } from "../context.js";
import { GitHubProvider } from "../integrations/index.js";
import { GitLabProvider } from "../integrations/index.js";
import { isProviderIssueLookupError } from "../integrations/index.js";
import { PROVIDER_ISSUE_LOOKUP_ERROR } from "../integrations/index.js";

/** Clean process evidence reused to vary untrusted provider response content.
 * @param stdout - External command JSON to deliver to the adapter.
 */
function completed(stdout: string): Awaited<ReturnType<RunCommand>> {
  return { stdout, stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}

/** Register rejection checks for malformed or mismatched provider issue identities.
 * @param Provider - Concrete facade whose public behavior is exercised.
 */
export function registerIssueIdentityTests(Provider: typeof GitHubProvider | typeof GitLabProvider): void {
  for (const identity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 404]) {
    it(`${Provider.name} rejects issue identity ${identity} instead of accepting another issue or proving absence`, async () => {
      let calls = 0;
      const provider = new Provider({ repoPath: ".", runCommand: async () => {
        calls++;

        return completed(JSON.stringify(Provider === GitHubProvider
          ? { number: identity, title: "Issue", body: "", state: "OPEN", labels: [], url: "https://git.test/team/repo/issues/42" }
          : { iid: identity, title: "Issue", description: "", state: "opened", labels: [], web_url: "https://git.test/team/repo/issues/42" }));
      } });

      await assert.rejects(provider.getIssue(42), error => isProviderIssueLookupError(error)
        && error.code === PROVIDER_ISSUE_LOOKUP_ERROR.UNKNOWN && !error.retryable);
      assert.equal(calls, 1, "invalid response content must not trigger an issue-not-found access probe");
    });
  }
}
