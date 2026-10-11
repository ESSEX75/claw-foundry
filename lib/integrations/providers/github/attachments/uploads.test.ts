/** Checks confirmed GitHub Contents upload identity and permanent public URLs. */

import assert from "node:assert/strict";
import path from "node:path";
import { it } from "node:test";
import type { RunCommand } from "../../../../context.js";
import { GitHubProvider } from "../index.js";

/** Deterministic process completion for provider-facing fixtures.
 * @param stdout - Serialized provider response.
 */
function success(stdout: string): Awaited<ReturnType<RunCommand>> {
  return { stdout, stderr: "", code: 0, signal: null, killed: false, termination: "exit" };
}

for (const resultKind of ["confirmed", "missing", "foreign", "invalid_url", "temporary_url", "timeout"]) {
  it(`GitHub publishes only a confirmed Contents response: ${resultKind}`, async () => {
    let uploads = 0;
    const runCommand: RunCommand = async argv => {
      if (argv[1] === "repo") return success('{"owner":{"login":"owner"},"name":"repo"}');
      if (!argv.includes("PUT")) return success('{"object":{"sha":"abc"}}');
      uploads++;
      const filePath = argv[2]?.split("/contents/")[1];
      assert.ok(filePath);
      if (resultKind === "timeout") return { ...success("{}"), termination: "timeout", code: null, killed: true };
      if (resultKind === "missing") return success("{}");
      return success(JSON.stringify({ content: { path: resultKind === "foreign" ? "other.txt" : filePath,
        sha: "a".repeat(40), download_url: resultKind === "invalid_url" ? "javascript:alert(1)"
          : resultKind === "temporary_url" ? "https://raw.git.test/confirmed.txt?token=temporary" : "https://raw.git.test/confirmed.txt" } }));
    };
    const url = await new GitHubProvider({ repoPath: ".", runCommand }).uploadAttachment(42,
      { filename: "../evidence.txt", buffer: Buffer.from("evidence"), mimeType: "text/plain" });
    assert.equal(url, resultKind === "confirmed" ? "https://raw.git.test/confirmed.txt" : null);
    assert.equal(uploads, 1);
  });
}
