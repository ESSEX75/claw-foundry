/** Resolves issue closure from ordered workflow actions without observing provider state. */

import { ACTION } from "./const.js";
import type { TransitionAction } from "./types.js";

/** Compute closure metadata for actions that have successfully run; undefined preserves prior metadata.
 * @param actions - Configured actions in execution order.
 * @param closedAt - Previously committed closure timestamp.
 * @param now - Timestamp supplied by the application for a new close.
 */
export function resolveIssueClosedAt(actions: readonly TransitionAction[], closedAt: string | null, now: string): string | null | undefined {
  let result: string | null | undefined;

  for (const action of actions) {
    if (action === ACTION.CLOSE_ISSUE) result = (result === undefined ? closedAt : result) ?? now;
    if (action === ACTION.REOPEN_ISSUE) result = null;
  }

  return result;
}
