/**
 * Resolves the installed Claw Foundry package root so setup assets use one explicit layout contract.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { getErrorMessage, hasErrorCode } from "../../../shared/errors/index.js";
import {
  CLAW_FOUNDRY_PACKAGE_NAME,
  DEFAULTS_DIRECTORY_NAME,
  PACKAGE_MANIFEST_FILE_NAME,
} from "./const.js";

/**
 * Locate the nearest ancestor whose package manifest identifies Claw Foundry.
 * Unrelated package manifests are skipped; malformed readable manifests fail with path context.
 *
 * @param startDirectory - Source or bundled module directory inside the Claw Foundry package.
 */
export async function findClawFoundryPackageRoot(startDirectory: string): Promise<string> {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    const manifestPath = path.join(currentDirectory, PACKAGE_MANIFEST_FILE_NAME);

    try {
      const manifest: unknown = JSON.parse(await fs.readFile(manifestPath, "utf-8"));

      if (isClawFoundryPackageManifest(manifest)) return currentDirectory;
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) {
        const message = getErrorMessage(error);

        throw new Error(`Cannot inspect package manifest ${manifestPath}: ${message}`, { cause: error });
      }
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }

  throw new Error(`Cannot locate package root for ${CLAW_FOUNDRY_PACKAGE_NAME} from ${startDirectory}.`);
}

/**
 * Resolve the single supported packaged-defaults location below the identified package root.
 *
 * @param startDirectory - Source or bundled module directory inside the Claw Foundry package.
 */
export async function resolveDefaultsDirectory(startDirectory: string): Promise<string> {
  return path.join(await findClawFoundryPackageRoot(startDirectory), DEFAULTS_DIRECTORY_NAME);
}

/**
 * Check whether an unknown parsed manifest identifies the Claw Foundry package.
 *
 * @param value - Unknown JSON value read from a candidate package manifest.
 */
function isClawFoundryPackageManifest(value: unknown): boolean {
  return typeof value === "object"
    && value !== null
    && "name" in value
    && value.name === CLAW_FOUNDRY_PACKAGE_NAME;
}
