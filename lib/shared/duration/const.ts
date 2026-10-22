/** Owns the shared grammar and conversion factors for explicit integral durations. */

/** Nonnegative integral duration with an explicit supported unit. */
export const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;

/** Millisecond factors; unknown units are never assigned a default multiplier. */
export const DURATION_MULTIPLIERS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};
