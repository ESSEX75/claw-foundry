/** Computes byte digests without owning payload selection or JSON canonicalization. */

import { createHash } from "node:crypto";

import { HASH_ALGORITHM, HASH_ENCODING } from "./const.js";

/**
 * Hash exact bytes or UTF-8 text with SHA-256, returning lowercase hexadecimal.
 * Callers retain field selection, JSON ordering and persisted identity contracts.
 * @param content - Complete bytes or already serialized text; no normalization is applied.
 */
export function sha256Hex(content: string | Uint8Array): string {
  return createHash(HASH_ALGORITHM).update(content).digest(HASH_ENCODING);
}
