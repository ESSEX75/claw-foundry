/** Reads workspace agent instructions and explicitly refreshes system documents. */

import fs from "node:fs/promises";
import path from "node:path";

import { hasErrorCode } from "../../../shared/errors/index.js";
import { FILESYSTEM_ERROR_CODE, STATE_TEXT_ENCODING } from "../../persistence/index.js";
import type { WorkspaceWriteResult } from "../documents/index.js";
import { backupAndWrite } from "../documents/index.js";
import { AGENTS_FILE_NAME, HEARTBEAT_FILE_NAME, loadSetupTemplates, TOOLS_FILE_NAME } from "../resources/index.js";

/**
 * Replace managed system instruction files through an explicit refresh operation, preserving backups.
 *
 * @param workspacePath - Workspace whose system instructions should be explicitly refreshed.
 */
export async function refreshSystemInstructionFiles(workspacePath: string): Promise<WorkspaceWriteResult> {
  const templates = await loadSetupTemplates();
  const files: Array<[string, string]> = [
    [AGENTS_FILE_NAME, templates.agents],
    [HEARTBEAT_FILE_NAME, templates.heartbeat],
    [TOOLS_FILE_NAME, templates.tools],
  ];

  for (const [relativePath, content] of files) await backupAndWrite(path.join(workspacePath, relativePath), content);

  return { written: files.map(([relativePath]) => relativePath) };
}

/** Read existing agent instructions for onboarding detection without creating files.
 * @param workspacePath - Workspace whose instructions may be absent.
 */
export async function readWorkspaceAgentInstructions(workspacePath: string): Promise<string | null> {
  try { return await fs.readFile(path.join(workspacePath, AGENTS_FILE_NAME), STATE_TEXT_ENCODING); }
  catch (error) {
    if (hasErrorCode(error, FILESYSTEM_ERROR_CODE.NOT_FOUND)) return null;
    throw error;
  }
}
