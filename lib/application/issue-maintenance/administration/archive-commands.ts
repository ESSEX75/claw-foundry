/** Resolves project archive policy for explicit inspection and bounded operator cleanup. */

import { randomUUID } from "node:crypto";

import { loadConfig } from "../../../state/index.js";
import { type ArchivePurgeResult, type ArchiveStatusResult, getIssueArchiveStatus, purgeIssueArchive } from "../archive/index.js";
import type { ProjectIssueScope, PurgeProjectIssueArchiveInput } from "./types.js";

/** Inspect local stores using the selected project's workflow and retention windows.
 * Reads do not require a registry entry and never initialize missing stores.
 * @param input - Exact workspace and project-local storage scope.
 */
export async function inspectProjectIssueArchive(input: ProjectIssueScope): Promise<ArchiveStatusResult> {
  const config = await loadConfig(input.workspaceDir, input.projectSlug);

  return getIssueArchiveStatus({
    ...input,
    archiveRetention: config.issueArchiveMaintenance.archiveRetention,
    deletedProviderRetention: config.issueArchiveMaintenance.deletedProviderRetention,
    workflow: config.workflow,
  });
}

/** Preview or apply bounded retention while preserving fresh ownership checks in archive commands.
 * @param input - Exact store scope, explicit mutation mode, and audit attribution.
 */
export async function purgeProjectIssueArchive(input: PurgeProjectIssueArchiveInput): Promise<ArchivePurgeResult> {
  const config = await loadConfig(input.workspaceDir, input.projectSlug);

  return purgeIssueArchive({
    ...input,
    archiveRetention: config.issueArchiveMaintenance.archiveRetention,
    deletedProviderRetention: config.issueArchiveMaintenance.deletedProviderRetention,
    maxItems: config.issueArchiveMaintenance.maxPerHeartbeat,
    correlationId: randomUUID(),
  });
}
