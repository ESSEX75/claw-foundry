/** Owns reusable tool-boundary primitives and derives SDK schemas from runtime validation. */

import { z } from "zod";

/** Text identifiers and required content must contain at least one non-whitespace character. */
export const requiredTextInput = z.string().min(1).regex(/\S/, "Must contain non-whitespace text.");

/** Provider-local issue identities must survive JSON and JavaScript number round trips exactly. */
export const issueIdInput = z.number().int().positive().safe();

/** Derive the agent-visible schema from the exact validator executed before tool effects.
 * @param schema - Owning adapter's strict input schema, including descriptions and optional fields.
 */
export function toolInputParameters(schema: z.ZodObject) {
  return z.toJSONSchema(schema, { target: "draft-7", io: "input" });
}
