/** Formats unknown failures for diagnostics without classifying operational outcomes. */

/**
 * Preserve Error.message and use normal string conversion for other thrown values.
 * The formatter supplies no retry, absence or delivery evidence of its own.
 * @param error - Failure caught from an application, filesystem or integration operation.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
