/** Preserves existing documents during explicit create-only scaffolding. */

import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { hasErrorCode } from "../../../shared/errors/index.js";
import { CREATE_ONLY_FILE_FLAG, FILESYSTEM_ERROR_CODE, LOCK_FILE_SUFFIX, STATE_TEXT_ENCODING, withFileLock } from "../../persistence/index.js";
import { DOCUMENT_LOCK_OPTIONS } from "./const.js";

/**
 * Determine whether a filesystem entry currently exists without exposing missing-file errors.
 *
 * @param filePath - Exact path whose existence should be queried.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);

    return true;
  } catch (error) {
    if (hasErrorCode(error, FILESYSTEM_ERROR_CODE.NOT_FOUND)) return false;
    throw error;
  }
}

/**
 * Write a new file only when its destination does not already exist.
 *
 * @param filePath - Exact create-only destination.
 * @param content - Content written only when the destination is absent.
 */
export async function writeIfMissing(filePath: string, content: string): Promise<boolean> {
  filePath = path.resolve(filePath);

  return withFileLock(`${filePath}${LOCK_FILE_SUFFIX}`, DOCUMENT_LOCK_OPTIONS, async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.writeFile(filePath, content, { encoding: STATE_TEXT_ENCODING, flag: CREATE_ONLY_FILE_FLAG });
    } catch (error) {
      if (hasErrorCode(error, FILESYSTEM_ERROR_CODE.ALREADY_EXISTS)) return false;
      throw error;
    }

    return true;
  });
}

/**
 * Copy one source file only when the destination does not already exist.
 *
 * @param sourcePath - Existing file whose bytes should be copied.
 * @param destinationPath - Create-only destination that must never be overwritten.
 */
export async function copyIfMissing(sourcePath: string, destinationPath: string): Promise<boolean> {
  destinationPath = path.resolve(destinationPath);

  return withFileLock(`${destinationPath}${LOCK_FILE_SUFFIX}`, DOCUMENT_LOCK_OPTIONS, async () => {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    try {
      await fs.copyFile(sourcePath, destinationPath, fsConstants.COPYFILE_EXCL);
    } catch (error) {
      if (hasErrorCode(error, FILESYSTEM_ERROR_CODE.ALREADY_EXISTS)) return false;
      throw error;
    }

    return true;
  });
}
