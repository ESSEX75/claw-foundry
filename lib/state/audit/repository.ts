/** Persists a bounded, best-effort diagnostic journal without controlling workflow recovery. */

import path from "node:path";

import { assertWorkspaceMigrated } from "../migration.js";
import { DATA_DIR, LOG_DIRECTORY_NAME } from "../paths.js";
import { LOCK_FILE_SUFFIX, withFileLock, writeFileAtomic } from "../persistence/index.js";
import { AUDIT_FILE_NAME, AUDIT_LOCK_OPTIONS, MAX_AUDIT_BYTES } from "./const.js";
import { readAuditText } from "./files.js";
import { pruneAuditArchives, recoverAuditRotation, rotateAuditLog } from "./rotation.js";
import type { AuditEntry } from "./types.js";
import { reportAuditFailure } from "./warnings.js";

/**
 * Add one diagnostic record, rotating at 10 MiB and retaining five completed archives.
 * Atomic publication and a persisted rotation plan preserve history across interrupted rotation.
 * All serialization, lock and filesystem failures are suppressed; resolution does not
 * prove persistence. Records are diagnostic only, never authoritative recovery evidence.
 * @param workspaceDir - Workspace owning the Claw Foundry diagnostic journal.
 * @param event - Event identity owned by the calling capability.
 * @param data - Flat diagnostic payload; ts/event are reserved and root custom serializers are unsupported.
 */
export async function log(workspaceDir: string, event: string, data: Record<string, unknown>): Promise<void> {
  try {
    assertWorkspaceMigrated(workspaceDir);

    const entry: AuditEntry = { ...data, ts: new Date().toISOString(), event };

    if (typeof entry["toJSON"] === "function") throw new Error("Custom root audit serializers are unsupported.");
    const serialized = JSON.stringify(entry);
    const record = `${serialized}\n`;

    if (Buffer.byteLength(record, "utf8") > MAX_AUDIT_BYTES) throw new Error("Audit record exceeds the 10 MiB byte limit.");
    const filePath = path.join(workspaceDir, DATA_DIR, LOG_DIRECTORY_NAME, AUDIT_FILE_NAME);

    await withFileLock(`${filePath}${LOCK_FILE_SUFFIX}`, AUDIT_LOCK_OPTIONS, async () => {
      await recoverAuditRotation(filePath);
      const current = await readAuditText(filePath) ?? "";
      const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";

      if (Buffer.byteLength(current + separator, "utf8") + Buffer.byteLength(record, "utf8") > MAX_AUDIT_BYTES) {
        await rotateAuditLog(filePath, current, serialized);
      } else {
        await writeFileAtomic(filePath, current + separator + record);
      }

      await pruneAuditArchives(filePath);
    });
  } catch (error) {
    reportAuditFailure(workspaceDir, event, error);
  }
}
