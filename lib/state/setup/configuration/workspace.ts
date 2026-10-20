/** Owns workspace configuration reads and explicit scoped default replacement. */

import fs from "node:fs/promises";
import path from "node:path";

import { hasErrorCode } from "../../../shared/errors/index.js";
import { DATA_DIR, WORKFLOW_FILE_NAME } from "../../paths.js";
import { FILESYSTEM_ERROR_CODE, STATE_TEXT_ENCODING } from "../../persistence/index.js";
import type { WorkspaceWriteResult } from "../documents/index.js";
import { backupAndWrite } from "../documents/index.js";
import { loadSetupTemplates,PROMPTS_DIRECTORY_NAME, ROLE_PROMPT_FILE_EXTENSION } from "../resources/index.js";
import { DEFAULTS_SCOPE } from "./const.js";
import { resetDefaults } from "./reset.js";
import type { DefaultsScope, WorkflowDocuments } from "./types.js";

/** Read both workflow documents without creating missing state.
 * @param workspacePath - Workspace to inspect.
 */
export async function readWorkflowDocuments(workspacePath: string): Promise<WorkflowDocuments> {
  let current: string | null = null;

  try { current = await fs.readFile(path.join(workspacePath, DATA_DIR, WORKFLOW_FILE_NAME), STATE_TEXT_ENCODING); }
  catch (error) {
    if (!hasErrorCode(error, FILESYSTEM_ERROR_CODE.NOT_FOUND)) throw error;
  }

  return { current, template: (await loadSetupTemplates()).workflow };
}

/** Replace only the explicitly selected defaults, with recoverable backups.
 * @param workspacePath - Workspace whose selected files will be replaced.
 * @param scope - Exact subset of defaults requested by the application.
 */
export async function resetWorkspaceConfiguration(workspacePath: string, scope: DefaultsScope): Promise<WorkspaceWriteResult> {
  if (scope === DEFAULTS_SCOPE.ALL) return resetDefaults(workspacePath);
  const templates = await loadSetupTemplates();
  const files: Array<[string, string]> = scope === DEFAULTS_SCOPE.WORKFLOW
    ? [[path.join(DATA_DIR, WORKFLOW_FILE_NAME), templates.workflow]]
    : Object.entries(templates.roleInstructions).filter(([, content]) => Boolean(content)).map(([role, content]) => [
      path.join(DATA_DIR, PROMPTS_DIRECTORY_NAME, `${role}${ROLE_PROMPT_FILE_EXTENSION}`), content,
    ]);

  for (const [relativePath, content] of files) await backupAndWrite(path.join(workspacePath, relativePath), content);

  return { written: files.map(([relativePath]) => relativePath) };
}
