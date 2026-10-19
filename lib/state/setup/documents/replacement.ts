/** Serializes document read-modify-write and publishes recoverable atomic replacements. */

import fs from "node:fs/promises";
import path from "node:path";

import { isErrnoException, LOCK_FILE_SUFFIX, withFileLock, writeFileAtomic } from "../../persistence/index.js";
import { BACKUP_FILE_SUFFIX, DOCUMENT_LOCK_OPTIONS } from "./const.js";

/**
 * Read the current document under its lock, preserve its exact bytes, then replace atomically.
 * Missing documents are explicit nulls; corruption and access failures propagate unchanged.
 * A null builder result leaves both document and backup unchanged.
 * @param filePath - Document shared by initialization, patches, refresh and reset.
 * @param build - Synchronous transformation of the fresh content, or null to skip replacement.
 */
export async function updateDocument(filePath: string, build: (previous: string | null) => string | null): Promise<boolean> {
  filePath = path.resolve(filePath);

  return withFileLock(`${filePath}${LOCK_FILE_SUFFIX}`, DOCUMENT_LOCK_OPTIONS, async () => {
    let previous: string | null;

    try {
      previous = await fs.readFile(filePath, "utf-8");
    } catch (error) {
      if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
      previous = null;
    }

    const content = build(previous);

    if (content === null) return false;
    if (previous !== null) await writeFileAtomic(`${filePath}${BACKUP_FILE_SUFFIX}`, previous);
    await writeFileAtomic(filePath, content);

    return true;
  });
}

/**
 * Explicitly replace a document while atomically preserving its previous contents.
 * @param filePath - Exact destination to replace under its document lock.
 * @param content - Complete replacement content.
 */
export async function backupAndWrite(filePath: string, content: string): Promise<void> {
  await updateDocument(path.resolve(filePath), () => content);
}
