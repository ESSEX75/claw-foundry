/** Inspects whether an SDK-resolved workspace has a valid managed project registry. */

import fs from "node:fs/promises";

import { readOptionalProjects } from "./repository.js";
import type { ManagedWorkspaceSnapshot } from "./types.js";

/** Canonicalize an existing workspace and read its optional strict registry.
 * Missing registries are uninitialized; malformed or inaccessible registries fail.
 * @param workspaceDir - Workspace resolved for a configured agent by the SDK.
 */
export async function inspectManagedWorkspace(workspaceDir: string): Promise<ManagedWorkspaceSnapshot> {
  const workspace = await fs.realpath(workspaceDir);

  return { workspace, projects: await readOptionalProjects(workspace) };
}
