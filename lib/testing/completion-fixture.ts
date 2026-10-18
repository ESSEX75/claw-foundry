/** Captures explicit fixture ownership before exercising the real completion use case. */

import { type CompletionInput, executeCompletion } from "../application/index.js";
import { readIssueStateStore } from "../state/index.js";

/** Fixture callers may capture current ownership or supply an earlier exact frame for races. */
type CompletionFixtureInput = Omit<CompletionInput, "expectedWorker"> & Partial<Pick<CompletionInput, "expectedWorker">>;

/** Complete an already constructed managed fixture; never manufactures runtime or slot ownership.
 * @param input - Real completion request with an optional explicitly captured fixture frame.
 */
export async function completeWorkerForTesting(input: CompletionFixtureInput) {
  const state = (await readIssueStateStore(input.workspaceDir, input.projectSlug)).issues[String(input.issueId)];
  const expectedWorker = input.expectedWorker ?? state?.activeWorker ?? state?.lastCompletion?.worker;

  if (!expectedWorker) throw new Error("Completion fixture requires explicit local worker ownership.");

  return executeCompletion({ ...input, expectedWorker });
}
