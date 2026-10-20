/** Defines structural error evidence independent of persistence and provider policy. */

/** An actual Error carrying a validated string code, without inferred retry semantics. */
export type CodedError = Error & {
  /** Boundary-supplied diagnostic code whose meaning belongs to the caller. */
  code: string;
};
