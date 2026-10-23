#!/usr/bin/env node

/** Explicit offline directory migration; never merges, rewrites, or resets managed records. */

import { lstat, rename } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/** Original workspace-relative directory retained only as migration input. */
const SOURCE_DIRECTORY = "devclaw";

/** Current workspace-relative directory used by Claw Foundry. */
const TARGET_DIRECTORY = "claw-foundry";

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 2 || (args[1] !== undefined && args[1] !== "--apply")) {
  throw new Error("Usage: node scripts/migrate-devclaw-state.mjs <absolute-workspace> [--apply]. Stop all writers and back up first; default is preview.");
}
if (!path.isAbsolute(args[0])) throw new Error("Workspace must be an absolute path.");
const workspace = path.resolve(args[0]);
const workspaceStat = await lstat(workspace);
if (!workspaceStat.isDirectory() || workspaceStat.isSymbolicLink()) throw new Error("Workspace must be a real directory, not a link.");
const source = path.join(workspace, SOURCE_DIRECTORY);
const target = path.join(workspace, TARGET_DIRECTORY);
const sourceStat = await lstat(source);
if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error("Source must be a real directory, not a link.");
try {
  await lstat(target);
  throw new Error(`Destination already exists: ${target}. Refusing to merge or overwrite.`);
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}
console.log(`${args[1] === "--apply" ? "Migrate" : "Preview"}: ${source} -> ${target}`);
if (args[1] === "--apply") {
  await rename(source, target);
  console.log("State directory moved intact. Complete the OpenClaw configuration steps in docs/MIGRATION.md before restarting.");
}
