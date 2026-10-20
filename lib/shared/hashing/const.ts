/** Fixes the algorithm and encoding of the shared byte-digest primitive. */

/** Stable SHA-256 algorithm; consumers own the meaning and serialization of its input. */
export const HASH_ALGORITHM = "sha256";

/** Lowercase hexadecimal representation of all 32 digest bytes. */
export const HASH_ENCODING = "hex";
