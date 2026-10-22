/** Presents completion results independently of workflow-edge resolution. */

import { COMPLETION_RESULT } from "./const.js";
import { isBuiltInCompletionResult } from "./guards.js";

/** Emoji displayed for known worker completion results. */
const RESULT_EMOJI = {
  [COMPLETION_RESULT.DONE]: "✅",
  [COMPLETION_RESULT.PASS]: "🎉",
  [COMPLETION_RESULT.FAIL]: "❌",
  [COMPLETION_RESULT.REFINE]: "🤔",
  [COMPLETION_RESULT.BLOCKED]: "🚫",
  [COMPLETION_RESULT.APPROVE]: "✅",
  [COMPLETION_RESULT.REJECT]: "❌",
} as const;

/** Fallback emoji displayed for an unknown completion result. */
const DEFAULT_RESULT_EMOJI = "📋";

/**
 * Get the configured emoji for a built-in completion result.
 * Unknown results use the stable default emoji.
 *
 * @param result - Completion result identifier to present.
 */
export function getCompletionEmoji(result: string): string {
  return isBuiltInCompletionResult(result)
    ? RESULT_EMOJI[result]
    : DEFAULT_RESULT_EMOJI;
}
