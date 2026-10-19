/** Computes the immutable source identity used to recover archive-first writes. */

import type { IssueRuntimeState } from "../../../domain/index.js";
import { sha256Hex } from "../../../hashing/index.js";

/** Hash the exact authoritative snapshot transferred to archive.
 * @param state - Fresh local issue record.
 */
export function hashIssueState(state: IssueRuntimeState): string {
  return sha256Hex(JSON.stringify(state));
}
