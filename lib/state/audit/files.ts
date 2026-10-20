/** Owns ordinary-file checks and canonical archive discovery for diagnostic storage. */

import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import { hasErrorCode } from "../../shared/errors/index.js";
import { FILESYSTEM_ERROR_CODE, STATE_TEXT_ENCODING } from "../persistence/index.js";
import { AUDIT_ARCHIVE_PATTERN, AUDIT_ARCHIVE_PREFIX, AUDIT_ARCHIVE_SEQUENCE_WIDTH, AUDIT_ARCHIVE_SUFFIX, AUDIT_ROTATION_FILE_NAME } from "./const.js";
import type { AuditArchive } from "./types.js";

/** Read an ordinary UTF-8 file; only confirmed absence produces undefined.
 * @param filePath - Audit resource protected by the caller's journal lock.
 */
export async function readAuditText(filePath: string): Promise<string | undefined> {
  try {
    const stat = await fs.lstat(filePath);

    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Audit resource must be an ordinary file: ${filePath}`);

    const content = await fs.readFile(filePath);

    return new TextDecoder(STATE_TEXT_ENCODING, { fatal: true, ignoreBOM: true }).decode(content);
  } catch (error) {
    if (hasErrorCode(error, FILESYSTEM_ERROR_CODE.NOT_FOUND)) return undefined;
    throw error;
  }
}

/** Resolve the private rotation plan beside its active journal.
 * @param filePath - Active audit.log owned by the repository.
 */
export function rotationPath(filePath: string): string {
  return path.join(path.dirname(filePath), AUDIT_ROTATION_FILE_NAME);
}

/** Resolve an archive from a validated positive safe sequence, never from a stored path.
 * @param filePath - Active journal selecting the containing directory.
 * @param sequence - Validated positive safe archive identity.
 */
export function archivePath(filePath: string, sequence: number): string {
  return path.join(path.dirname(filePath), `${AUDIT_ARCHIVE_PREFIX}${String(sequence).padStart(AUDIT_ARCHIVE_SEQUENCE_WIDTH, "0")}${AUDIT_ARCHIVE_SUFFIX}`);
}

/** List canonical ordinary archives in descending sequence order, preserving unrelated entries.
 * @param filePath - Active journal whose process-owned lock is held by the caller.
 */
export async function listAuditArchives(filePath: string): Promise<AuditArchive[]> {
  const archives: AuditArchive[] = [];

  for (const name of await fs.readdir(path.dirname(filePath))) {
    const match = AUDIT_ARCHIVE_PATTERN.exec(name);

    if (!match) continue;
    const sequence = Number(match[1]);
    const target = archivePath(filePath, sequence);

    if (!Number.isSafeInteger(sequence) || sequence < 1 || path.basename(target) !== name) throw new Error(`Invalid audit archive sequence: ${name}`);
    const stat = await fs.lstat(target);

    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Audit archive must be an ordinary file: ${target}`);
    archives.push({ sequence, filePath: target });
  }

  return archives.sort((first, second) => second.sequence - first.sequence);
}
