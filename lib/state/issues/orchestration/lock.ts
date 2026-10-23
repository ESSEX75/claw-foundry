/**
 * Serializes application orchestration for one managed issue through state-owned locks.
 */

import path from "node:path";

import { assertWorkspaceMigrated } from "../../migration.js";
import { DATA_DIR, PROJECTS_DIRECTORY_NAME } from "../../paths.js";
import { LOCK_FILE_SUFFIX, withFileLock } from "../../persistence/index.js";
import { parseProjectSlug } from "../../projects/index.js";
import { ISSUE_ORCHESTRATION_LOCK_OPTIONS, ORCHESTRATION_LOCKS_DIRECTORY_NAME } from "../const.js";

/** Optional per-call overrides for the default issue orchestration lock policy. */
type IssueLockOptions = {
  /** Minimum age before checking whether a local owner has exited; live owners never expire. */
  staleMs?: number;
  /** Delay between contended acquisition attempts. */
  retryMs?: number;
  /** Maximum time to wait for orchestration ownership. */
  timeoutMs?: number;
};

/**
 * Resolve the ownership directory dedicated to one managed issue.
 *
 * @param workspaceDir - Workspace containing project-local issue state.
 * @param projectSlug - Project that owns the issue.
 * @param issueId - Provider-local issue identifier.
 */
export function issueOrchestrationLockPath(
  workspaceDir: string,
  projectSlug: string,
  issueId: number,
): string {
  assertWorkspaceMigrated(workspaceDir);

  return path.join(
    workspaceDir, DATA_DIR, PROJECTS_DIRECTORY_NAME, parseProjectSlug(projectSlug),
    ORCHESTRATION_LOCKS_DIRECTORY_NAME,
    `${issueId}${LOCK_FILE_SUFFIX}`,
  );
}

/**
 * Run one orchestration operation while holding exclusive issue ownership.
 *
 * @param workspaceDir - Workspace containing project-local issue state.
 * @param projectSlug - Project that owns the issue.
 * @param issueId - Provider-local issue identifier.
 * @param operation - Orchestration work to serialize.
 * @param options - Optional timing overrides used primarily by tests.
 */
export async function withIssueOrchestrationLock<T>(
  workspaceDir: string,
  projectSlug: string,
  issueId: number,
  operation: () => T | Promise<T>,
  options: IssueLockOptions = {},
): Promise<T> {
  const lockPath = issueOrchestrationLockPath(workspaceDir, projectSlug, issueId);

  return withFileLock(lockPath, {
    retryMs: options.retryMs ?? ISSUE_ORCHESTRATION_LOCK_OPTIONS.retryMs,
    staleMs: options.staleMs ?? ISSUE_ORCHESTRATION_LOCK_OPTIONS.staleMs,
    timeoutMs: options.timeoutMs ?? ISSUE_ORCHESTRATION_LOCK_OPTIONS.timeoutMs,
  }, operation);
}
