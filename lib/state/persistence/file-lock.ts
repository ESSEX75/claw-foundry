/** Serializes cooperative local writers without expiring a paused live owner. */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";

import { z } from "zod";

import { hasErrorCode } from "../../shared/errors/index.js";
import { LOCK_CLAIM_SUFFIX, LOCK_RECORD_EXTENSION } from "./const.js";
import type { FileLockOptions, FileLockRecord } from "./types.js";

/** Only the current immutable process ownership contract authorizes recovery. */
const FileLockRecordSchema = z.object({
  token: z.string().uuid(),
  processId: z.number().int().positive().safe(),
  hostname: z.string().min(1),
  createdAt: z.number().nonnegative().finite(),
}).strict();

/**
 * Publish complete ownership atomically and hold it until the callback settles.
 * Live local processes and foreign hosts never expire. Cooperative writers must not
 * remove locks externally; malformed or former lock formats require operator repair.
 * @param lockPath - Directory path dedicated to this repository lock.
 * @param options - Wait policy and minimum age for dead-process recovery.
 * @param operation - Work serialized until its promise settles, including failure cleanup.
 */
export async function withFileLock<T>(
  lockPath: string,
  options: FileLockOptions,
  operation: () => T | Promise<T>,
): Promise<T> {
  const owner: FileLockRecord = {
    token: randomUUID(), processId: process.pid, hostname: hostname(), createdAt: Date.now(),
  };

  await acquireLock(lockPath, owner, options);
  try {
    return await operation();
  } finally {
    await removeOwnership(lockPath, owner.token);
  }
}

/**
 * Prepare a nonempty claim before rename, so no observer sees an empty live lock.
 * Only an empty directory can be replaced by rename on POSIX; ownership is nonempty.
 * @param lockPath - Lock directory to publish without replacing a live owner.
 * @param owner - Immutable local process identity.
 * @param options - Contention and abandoned-process inspection policy.
 */
async function acquireLock(lockPath: string, owner: FileLockRecord, options: FileLockOptions): Promise<void> {
  const deadline = Date.now() + options.timeoutMs;

  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const claimPath = await fs.mkdtemp(`${lockPath}${LOCK_CLAIM_SUFFIX}`);
  let published = false;
  let publicationFailure: unknown;

  try {
    await fs.writeFile(markerPath(claimPath, owner.token), JSON.stringify(owner), { flag: "wx" });
    while (Date.now() <= deadline) {
      if (await lockEntryExists(lockPath)) {
        if (await recoverAbandonedLock(lockPath, options.staleMs)) continue;
      } else {
        try {
          await fs.rename(claimPath, lockPath);
          published = true;

          return;
        } catch (error) {
          if (!hasErrorCode(error) || !["EEXIST", "ENOTEMPTY", "EPERM", "EACCES", "ENOTDIR", "EISDIR"].includes(error.code)) throw error;
          publicationFailure = error;
          if (await lockEntryExists(lockPath) && await recoverAbandonedLock(lockPath, options.staleMs)) continue;
        }
      }

      if (Date.now() >= deadline) break;
      await new Promise<void>(resolve => setTimeout(resolve, options.retryMs));
    }

    throw new Error(`Timed out waiting for state lock: ${lockPath}`, { cause: publicationFailure });
  } finally {
    if (!published) await removeOwnership(claimPath, owner.token);
  }
}

/**
 * Inspect existing entries before publication, preserving old files on Windows rename.
 * @param lockPath - Target whose absence permits publishing a complete directory.
 */
async function lockEntryExists(lockPath: string): Promise<boolean> {
  try {
    await fs.lstat(lockPath);

    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false;
    throw error;
  }
}

/**
 * Recover only a proven dead local process. Age alone never revokes ownership.
 * A stale observer unlinks its observed token; rmdir cannot remove a new nonempty owner.
 * @param lockPath - Published directory to inspect without following links.
 * @param staleMs - Minimum age before attempting a process-liveness check.
 */
async function recoverAbandonedLock(lockPath: string, staleMs: number): Promise<boolean> {
  try {
    const stat = await fs.lstat(lockPath);

    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`State lock requires operator repair (expected an ownership directory): ${lockPath}`);
    }

    const entries = await fs.readdir(lockPath);

    if (entries.length === 0) {
      await removeEmptyDirectory(lockPath);

      return true;
    }

    if (entries.length !== 1) throw new Error(`Invalid state lock ownership directory: ${lockPath}`);
    const entry = entries[0]!;
    const entryPath = path.join(lockPath, entry);
    const marker = await fs.lstat(entryPath);

    if (marker.isSymbolicLink() || !marker.isFile()) throw new Error(`Invalid state lock marker: ${entryPath}`);
    const raw: unknown = JSON.parse(await fs.readFile(entryPath, "utf-8"));
    const record = FileLockRecordSchema.parse(raw);

    if (entry !== `${record.token}${LOCK_RECORD_EXTENSION}`) throw new Error(`State lock token mismatch: ${lockPath}`);
    if (record.hostname !== hostname() || Date.now() - record.createdAt < staleMs || isProcessAlive(record.processId)) return false;
    await removeOwnership(lockPath, record.token);

    return true;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return true;
    throw new Error(`Cannot inspect state lock ${lockPath}; inspect ownership before repairing it.`, { cause: error });
  }
}

/**
 * Treat denied or unknown process outcomes as live, preserving exclusive ownership.
 * @param processId - Process on this host recorded by the immutable marker.
 */
function isProcessAlive(processId: number): boolean {
  try {
    process.kill(processId, 0);

    return true;
  } catch (error) {
    return !hasErrorCode(error, "ESRCH");
  }
}

/**
 * Remove only the unique observed marker and an empty directory, never recursively.
 * @param lockPath - Published or unpublished ownership directory.
 * @param token - Immutable token identifying the only marker this caller may unlink.
 */
async function removeOwnership(lockPath: string, token: string): Promise<void> {
  try {
    await fs.unlink(markerPath(lockPath, token));
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) throw error;
  }

  await removeEmptyDirectory(lockPath);
}

/**
 * Leave replacement ownership intact even after delayed recovery.
 * @param directory - Directory which may already have disappeared or been republished.
 */
async function removeEmptyDirectory(directory: string): Promise<void> {
  try {
    await fs.rmdir(directory);
  } catch (error) {
    if (!hasErrorCode(error) || !["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)) throw error;
  }
}

/**
 * Address a marker using an internally generated or validated UUID.
 * @param directory - Ownership directory containing the immutable marker.
 * @param token - Unique acquisition UUID.
 */
function markerPath(directory: string, token: string): string {
  return path.join(directory, `${token}${LOCK_RECORD_EXTENSION}`);
}
