/** Adds operator repair commands to read-only task diagnostics without changing their evidence. */

import type { TaskIssueSummary } from "../../../../application/index.js";

/** Render guidance from the application's explicit diagnostic facts.
 * @param issue - Local-state-first provider summary.
 */
export function renderTaskIssue(issue: TaskIssueSummary) {
  const projection = issue.projection;

  return { ...issue, projection: { ...projection,
    repairHint: projection.needsRepair ? `claw-foundry issue_repair ${issue.id} --source local-state --dry-run` : null,
    ...(projection.workerDelivery ? {
      deliveryHint: `Inspect OpenClaw session ${projection.workerSessionKey ?? "unknown"} and the worker slot before retrying issue #${issue.id}.`
        + " Use claw-foundry worker-delivery --help with this marker's operationId as --delivery-id to preview and apply a verified conclusion.",
    } : {}),
  } };
}
