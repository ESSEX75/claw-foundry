/**
 * Provides filesystem path resolution for project registry files and repository roots.
 */

import { homedir } from "node:os";
import path from "node:path";

import { assertWorkspaceMigrated } from "../migration.js";
import { DATA_DIR, PROJECTS_FILE_NAME } from "../paths.js";

/**
 * Resolve the workspace projects-registry path.
 *
 * @param workspaceDir - Workspace containing Claw Foundry-managed state.
 */
export function projectsPath(workspaceDir: string): string {
  assertWorkspaceMigrated(workspaceDir);

  return path.join(workspaceDir, DATA_DIR, PROJECTS_FILE_NAME);
}

/**
 * Resolve a repository path from the projects registry, expanding a home-relative prefix.
 *
 * @param repoField - Configured repository path to resolve.
 */
export function resolveRepoPath(repoField: string): string {
  if (repoField.startsWith("~/")) {
    return repoField.replace("~", homedir());
  }

  return repoField;
}
