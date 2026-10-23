/** Prevents an upstream workspace from silently becoming a second, empty installation. */

import { lstatSync } from "node:fs";
import path from "node:path";

import { hasErrorCode } from "../shared/errors/index.js";
import { UPSTREAM_DATA_DIR } from "./paths.js";

/**
 * Refuse old or ambiguous workspace layouts without creating or changing data.
 * Permission errors remain failures, and links are never treated as missing state.
 * @param workspaceDir - Workspace to inspect before registry access or setup.
 */
export function assertWorkspaceMigrated(workspaceDir: string): void {
  const upstreamPath = path.join(workspaceDir, UPSTREAM_DATA_DIR);

  try {
    lstatSync(upstreamPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return;
    throw error;
  }

  throw new Error(`Existing DevClaw state at ${upstreamPath}. Stop all writers, back up the workspace, and follow docs/MIGRATION.md before using Claw Foundry.`);
}
