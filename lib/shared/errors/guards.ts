/** Narrows coded error evidence without interpreting text, causes or recovery policy. */

import type { CodedError } from "./types.js";

/**
 * Accept only an Error with a string code, optionally matching one exact code.
 * Plain objects and nested causes are not adopted as error evidence implicitly.
 * @param value - Unknown failure received at a boundary.
 * @param code - Optional exact code selected by the owning caller.
 */
export function hasErrorCode(value: unknown, code?: string): value is CodedError {
  return value instanceof Error && "code" in value && typeof value.code === "string"
    && (code === undefined || value.code === code);
}
