/** Persists a bounded, best-effort diagnostic journal without controlling workflow recovery. */

import fs from "node:fs/promises";
import path from "node:path";

import { hasErrorCode } from "../../shared/errors/index.js";
import { DATA_DIR, LOG_DIRECTORY_NAME } from "../paths.js";
import { FILESYSTEM_ERROR_CODE, LOCK_FILE_SUFFIX, STATE_TEXT_ENCODING, withFileLock, writeFileAtomic } from "../persistence/index.js";
import { AUDIT_FILE_NAME, AUDIT_LOCK_OPTIONS, MAX_AUDIT_RECORDS } from "./const.js";
import type { AuditEntry } from "./types.js";

/**
 * Add one diagnostic record and retain the latest 50 records under a process-owned lock.
 * Atomic publication preserves the prior journal if reading or replacement fails.
 * All serialization, lock and filesystem failures are suppressed; resolution does not
 * prove persistence. Records are diagnostic only, never authoritative recovery evidence.
 * @param workspaceDir - Workspace owning the DevClaw diagnostic journal.
 * @param event - Event identity owned by the calling capability.
 * @param data - Flat diagnostic payload; ts/event are reserved and root custom serializers are unsupported.
 */
export async function log(workspaceDir: string, event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const entry: AuditEntry = { ...data, ts: new Date().toISOString(), event };

    if (typeof entry["toJSON"] === "function") return;
    const serialized = JSON.stringify(entry);
    const filePath = path.join(workspaceDir, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

    await withFileLock(`${filePath}${LOCK_FILE_SUFFIX}`, AUDIT_LOCK_OPTIONS, async () => {
      const lines = await readAuditLines(filePath);
      const retained = [...lines.slice(-(MAX_AUDIT_RECORDS - 1)), serialized];

      await writeFileAtomic(filePath, `${retained.join("\n")}\n`);
    });
  } catch {
    // Diagnostics must not change the outcome of the operation being observed.
  }
}

/**
 * Preserve existing records, treating only confirmed absence as an empty journal.
 * Other read failures abort publication rather than overwrite an unreadable journal.
 * @param filePath - Journal whose lock is already held by the caller.
 */
async function readAuditLines(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, STATE_TEXT_ENCODING);

    return content.split("\n").filter(line => line.length > 0);
  } catch (error) {
    if (hasErrorCode(error, FILESYSTEM_ERROR_CODE.NOT_FOUND)) return [];
    throw error;
  }
}
