/** Parses strict durations independently of retention policy or scheduling effects. */

import { DURATION_MULTIPLIERS, DURATION_PATTERN } from "./const.js";

/**
 * Parse a nonnegative integral duration, rejecting malformed syntax and overflow.
 * @param value - Duration with an explicit ms, s, m, h or d unit, without whitespace.
 */
export function parseDuration(value: string): number {
  const match = DURATION_PATTERN.exec(value);

  if (!match) throw new Error(`Invalid duration "${value}".`);
  const result = Number(match[1]) * (DURATION_MULTIPLIERS[match[2]] ?? NaN);

  if (!Number.isSafeInteger(result)) throw new Error(`Duration "${value}" exceeds the safe range.`);

  return result;
}
