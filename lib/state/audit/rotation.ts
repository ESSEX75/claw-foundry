/** Resumes archive publication and active-file replacement before expiring completed audit history. */

import fs from "node:fs/promises";

import { sha256Hex } from "../../shared/hashing/index.js";
import { writeFileAtomic, writeJsonAtomic } from "../persistence/index.js";
import { MAX_AUDIT_ARCHIVES } from "./const.js";
import { archivePath, listAuditArchives, readAuditText, rotationPath } from "./files.js";
import { parseRotationIntent } from "./schema.js";
import type { AuditRotationIntent } from "./types.js";

/** Persist the intent before creating an archive or replacing current records.
 * @param filePath - Active journal protected by its process-owned lock.
 * @param source - Complete source history already read under that lock.
 * @param record - Bounded serialized object admitted by the repository.
 */
export async function rotateAuditLog(filePath: string, source: string, record: string): Promise<void> {
  const archives = await listAuditArchives(filePath);
  const sequence = (archives[0]?.sequence ?? 0) + 1;

  if (!Number.isSafeInteger(sequence)) throw new Error("Audit archive sequence exhausted.");
  const intent: AuditRotationIntent = { sequence, sourceDigest: sha256Hex(source), record };

  await writeJsonAtomic(rotationPath(filePath), intent);
  await recoverAuditRotation(filePath);
}

/** Resume only the exact persisted source/archive/replacement frame, failing closed on drift.
 * Archive publication precedes active replacement; an already published replacement
 * is never reset. The plan remains until both copies are confirmed, so retries cannot
 * create duplicate archives that prematurely expire older history.
 * @param filePath - Active journal protected by its process-owned lock.
 */
export async function recoverAuditRotation(filePath: string): Promise<void> {
  const content = await readAuditText(rotationPath(filePath));

  if (content === undefined) return;
  const intent = parseRotationIntent(content);
  const current = await readAuditText(filePath);
  const archive = archivePath(filePath, intent.sequence);
  const archived = await readAuditText(archive);
  const replacement = `${intent.record}\n`;

  if (current === undefined) throw new Error("Active audit journal disappeared during rotation.");
  const currentDigest = sha256Hex(current);

  if (currentDigest !== intent.sourceDigest && current !== replacement) throw new Error("Active audit journal changed outside the pending rotation.");
  if (archived === undefined) {
    if (currentDigest !== intent.sourceDigest) throw new Error("Pending audit rotation lost its source archive.");
    await writeFileAtomic(archive, current);
  } else if (sha256Hex(archived) !== intent.sourceDigest) {
    throw new Error("Pending audit archive differs from its source digest.");
  }

  if (current !== replacement) await writeFileAtomic(filePath, replacement);
  await fs.unlink(rotationPath(filePath));
}

/** Delete only excess ordinary archives after the rotation plan has been fully settled.
 * Failure leaves additional archives for a later locked retry, never an unarchived source.
 * @param filePath - Active journal whose completed rotation permits retention cleanup.
 */
export async function pruneAuditArchives(filePath: string): Promise<void> {
  const archives = await listAuditArchives(filePath);

  for (const archive of archives.slice(MAX_AUDIT_ARCHIVES)) await fs.unlink(archive.filePath);
}
