/** Validates physical command completion consistently before adapters interpret response or failure text. */

import { COMMAND_EXIT_TERMINATION } from "./const.js";
import type { CommandResult, CompletedCommandResult } from "./types.js";

/** Establish only clean process completion; a nonzero exit remains an operation-specific failure.
 * @param result - Process evidence returned by the plugin transport.
 */
export function isCompletedCommand(result: CommandResult): result is CompletedCommandResult {
  return result.termination === COMMAND_EXIT_TERMINATION && result.killed === false && result.signal === null
    && result.code !== null && Number.isInteger(result.code);
}
