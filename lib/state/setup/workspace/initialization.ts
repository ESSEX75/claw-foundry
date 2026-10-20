/** Creates missing workspace files without replacing user-owned documents. */

import fs from "node:fs/promises";
import path from "node:path";

import { getAllRoleIds } from "../../../roles/index.js";
import { DATA_DIR, LOG_DIRECTORY_NAME, PROJECTS_DIRECTORY_NAME, PROJECTS_FILE_NAME, WORKFLOW_FILE_NAME } from "../../paths.js";
import type { WorkspaceWriteResult } from "../documents/index.js";
import { copyIfMissing, fileExists, writeIfMissing } from "../documents/index.js";
import {
  AGENTS_FILE_NAME,
  HEARTBEAT_FILE_NAME,
  IDENTITY_FILE_NAME,
  loadSetupTemplates,
  PROMPTS_DIRECTORY_NAME,
  ROLE_PROMPT_FILE_EXTENSION,
  SOUL_FILE_NAME,
  TOOLS_FILE_NAME,
  USER_FILE_NAME,
} from "../resources/index.js";

/**
 * Create the current managed workspace structure and defaults without overwriting existing files.
 *
 * @param workspacePath - Workspace whose missing current files should be created.
 */
export async function initializeWorkspaceFiles(workspacePath: string): Promise<WorkspaceWriteResult> {
  const templates = await loadSetupTemplates();
  const dataDir = path.join(workspacePath, DATA_DIR);
  const written: string[] = [];

  await ensureDirectories(dataDir);
  const files: Array<[string, string]> = [
    [path.join(workspacePath, AGENTS_FILE_NAME), templates.agents],
    [path.join(workspacePath, HEARTBEAT_FILE_NAME), templates.heartbeat],
    [path.join(workspacePath, IDENTITY_FILE_NAME), templates.identity],
    [path.join(workspacePath, TOOLS_FILE_NAME), templates.tools],
    [path.join(dataDir, WORKFLOW_FILE_NAME), templates.workflow],
    [path.join(dataDir, PROJECTS_FILE_NAME), `${JSON.stringify({ projects: {} }, null, 2)}\n`],
    ...getAllRoleIds().flatMap((role): Array<[string, string]> => {
      const content = templates.roleInstructions[role];

      return content ? [[path.join(dataDir, PROMPTS_DIRECTORY_NAME, `${role}${ROLE_PROMPT_FILE_EXTENSION}`), content]] : [];
    }),
  ];

  for (const [filePath, content] of files) {
    if (await writeIfMissing(filePath, content)) written.push(path.relative(workspacePath, filePath));
  }

  return { written };
}

/**
 * Scaffold a new agent workspace with create-only identity files and the current managed structure.
 *
 * @param workspacePath - New agent workspace to scaffold.
 * @param defaultWorkspacePath - Optional source for a create-only USER.md copy.
 */
export async function scaffoldWorkspace(workspacePath: string, defaultWorkspacePath?: string): Promise<WorkspaceWriteResult> {
  const templates = await loadSetupTemplates();
  const written: string[] = [];

  if (await writeIfMissing(path.join(workspacePath, SOUL_FILE_NAME), templates.soul)) written.push(SOUL_FILE_NAME);
  if (defaultWorkspacePath) {
    const source = path.join(defaultWorkspacePath, USER_FILE_NAME);

    if (await fileExists(source) && await copyIfMissing(source, path.join(workspacePath, USER_FILE_NAME))) {
      written.push(USER_FILE_NAME);
    }
  }

  const initialized = await initializeWorkspaceFiles(workspacePath);

  return { written: [...written, ...initialized.written] };
}

/**
 * Create every directory required by current setup and runtime persistence capabilities.
 *
 * @param dataDir - DevClaw data directory whose current structure is required.
 */
async function ensureDirectories(dataDir: string): Promise<void> {
  await Promise.all([
    dataDir,
    path.join(dataDir, PROJECTS_DIRECTORY_NAME),
    path.join(dataDir, PROMPTS_DIRECTORY_NAME),
    path.join(dataDir, LOG_DIRECTORY_NAME),
  ].map((dir) => fs.mkdir(dir, { recursive: true })));
}
