#!/usr/bin/env node

/** Runs all Node test suites without shell argument limits, including on Windows. */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { run } from "node:test";
import { spec } from "node:test/reporters";

import { verifyStateProcessLocks } from "./state-lock-tests.mjs";
import { verifyAuditProcessWriters } from "./audit-process-tests.mjs";

await verifyStateProcessLocks();
console.log("State process-lock checks passed (contention, event-loop pause, owner exit).");
await verifyAuditProcessWriters();
console.log("Audit process checks passed (concurrent retention).");

const root = process.cwd();
const testFiles = [];

for await (const file of walk(path.join(root, "lib"))) {
  if (!file.endsWith(".test.ts") && !file.endsWith(".e2e.test.ts")) continue;
  const content = await readFile(file, "utf8");

  if (content.includes("from \"node:test\"") || content.includes("from 'node:test'")) {
    testFiles.push(path.relative(root, file));
  }
}

testFiles.sort();

if (testFiles.length === 0) {
  console.error("No node:test TypeScript test files found.");
  process.exit(1);
}

const tests = run({
  concurrency: true,
  files: testFiles,
  cwd: root,
  execArgv: ["--import", "tsx"],
});

tests.on("test:fail", () => {
  process.exitCode = 1;
});
tests.compose(spec()).pipe(process.stdout);

/** Discover test candidates without relying on shell expansion.
 * @param dir - Repository directory whose descendants should be inspected.
 */
async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}
