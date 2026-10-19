/** Explicitly replaces packaged configuration defaults while preserving backups. */

import path from "node:path";

import { DATA_DIR, WORKFLOW_FILE_NAME } from "../../paths.js";
import type { WorkspaceWriteResult } from "../documents/index.js";
import { backupAndWrite } from "../documents/index.js";
import {
  AGENTS_FILE_NAME,
  HEARTBEAT_FILE_NAME,
  IDENTITY_FILE_NAME,
  loadSetupTemplates,
  PROMPTS_DIRECTORY_NAME,
  ROLE_PROMPT_FILE_EXTENSION,
  TOOLS_FILE_NAME,
} from "../resources/index.js";

/**
 * Reset managed defaults to packaged content while preserving prior files as adjacent backups.
 *
 * @param workspacePath - Workspace whose defaults are explicitly reset with recoverable backups.
 */
export async function resetDefaults(workspacePath: string): Promise<WorkspaceWriteResult> {
  const templates = await loadSetupTemplates();
  const dataDir = path.join(workspacePath, DATA_DIR);

  const files: Array<[string, string]> = [
    [path.join(workspacePath, AGENTS_FILE_NAME), templates.agents],
    [path.join(workspacePath, HEARTBEAT_FILE_NAME), templates.heartbeat],
    [path.join(workspacePath, IDENTITY_FILE_NAME), templates.identity],
    [path.join(workspacePath, TOOLS_FILE_NAME), templates.tools],
    [path.join(dataDir, WORKFLOW_FILE_NAME), templates.workflow],
    ...Object.entries(templates.roleInstructions).map(([role, content]): [string, string] => [
      path.join(dataDir, PROMPTS_DIRECTORY_NAME, `${role}${ROLE_PROMPT_FILE_EXTENSION}`),
      content,
    ]),
  ];

  for (const [filePath, content] of files) await backupAndWrite(filePath, content);

  return { written: files.map(([filePath]) => path.relative(workspacePath, filePath)) };
}
