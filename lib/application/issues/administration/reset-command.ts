/** Owns explicit operator confirmation for destructive replacement of active and archive stores. */

import { resetIssueStores } from "../../../state/index.js";
import type { ResetProjectIssueStoresInput, ResetProjectIssueStoresResult } from "./types.js";

/** Replace only active/archive stores, retaining registry, slots, creation/recovery evidence and attachments.
 * Configuration and registry reads are deliberately unnecessary for this recovery operation.
 * State serializes both replacements under its project issue-store lock; they are not a single file transaction.
 * @param input - Project-local recovery scope and exact repeated project confirmation.
 */
export async function resetProjectIssueStores(input: ResetProjectIssueStoresInput): Promise<ResetProjectIssueStoresResult> {
  if (input.confirmProjectSlug !== input.projectSlug) throw new Error("confirmProjectSlug must exactly match projectSlug.");
  await resetIssueStores(input.workspaceDir, input.projectSlug);

  return { projectSlug: input.projectSlug, reset: true };
}
