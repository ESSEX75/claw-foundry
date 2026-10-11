/** Checks command capture integrity before adapters interpret output, without narrowing transport types. */

import type { CommandResult } from "./types.js";

/** Reject explicitly clipped output even if its surviving JSON or diagnostic looks valid.
 * This does not decide command acceptance when an adapter only needs exit evidence.
 * @param result - Capture metadata supplied by the plugin-owned process transport.
 */
export function isCompleteCommandOutput(result: CommandResult): boolean {
  return (result.stdoutTruncatedBytes ?? 0) === 0 && (result.stderrTruncatedBytes ?? 0) === 0
    && result.outputErrorStream === undefined;
}
