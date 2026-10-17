/** Produces read-only readiness snapshots for collection queries without caching across operations. */

import { ISSUE_CREATION_STATUS } from "../../../domain/index.js";
import { readIssueCreationStore } from "./repository.js";
import type { IssueCreationStore } from "./types.js";

/** Query ready identities from one validated store snapshot; never use it to authorize a later mutation.
 * @param store - Creation store read for the current query.
 */
export function getReadyIssueCreationIds(store: IssueCreationStore): ReadonlySet<string> {
  return new Set(Object.values(store.operations).filter(operation => operation.status === ISSUE_CREATION_STATUS.READY)
    .map(operation => operation.operationId));
}

/** Read a single readiness snapshot for a bounded collection query.
 * @param workspaceDir - Workspace containing project creation state.
 * @param projectSlug - Canonical project whose query is being evaluated.
 */
export async function readReadyIssueCreationIds(workspaceDir: string, projectSlug: string): Promise<ReadonlySet<string>> {
  return getReadyIssueCreationIds(await readIssueCreationStore(workspaceDir, projectSlug));
}
