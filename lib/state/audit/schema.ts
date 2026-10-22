/** Validates interrupted audit rotation plans before they authorize filesystem replacement. */

import { z } from "zod";

import { AUDIT_DIGEST_PATTERN, MAX_AUDIT_BYTES } from "./const.js";
import type { AuditRotationIntent } from "./types.js";

/** Only one bounded serialized object with the diagnostic envelope may replace the active file. */
const AuditRotationIntentSchema = z.object({
  sequence: z.number().int().positive().safe(),
  sourceDigest: z.string().regex(AUDIT_DIGEST_PATTERN),
  record: z.string().min(1).refine(validSerializedRecord, "Invalid audit rotation record"),
}).strict();

/** Validate byte size, line framing and metadata without trusting a stored serialization.
 * @param record - Serialized NDJSON object from the untrusted rotation plan.
 */
function validSerializedRecord(record: string): boolean {
  if (Buffer.byteLength(`${record}\n`, "utf8") > MAX_AUDIT_BYTES || /[\r\n]/.test(record)) return false;
  try {
    const value: unknown = JSON.parse(record);

    return typeof value === "object" && value !== null && "ts" in value && typeof value.ts === "string"
      && "event" in value && typeof value.event === "string";
  } catch {
    return false;
  }
}

/** Parse a strict rotation plan; malformed or unsupported evidence is never repaired implicitly.
 * @param content - Complete UTF-8 contents of the journal's private rotation plan.
 */
export function parseRotationIntent(content: string): AuditRotationIntent {
  const raw: unknown = JSON.parse(content);

  return AuditRotationIntentSchema.parse(raw);
}
