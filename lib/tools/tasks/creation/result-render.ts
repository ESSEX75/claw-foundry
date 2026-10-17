/** Adds operator guidance to durable creation facts without changing readiness or retry policy. */

import type { CreatedManagedTask } from "../../../application/index.js";

/** Render the established tool-facing guidance for ready, pending and known-issue recovery results.
 * @param created - Authoritative creation outcome from the application.
 */
export function renderCreationResult(created: CreatedManagedTask) {
  return { ...created,
    recovery: created.recovery ? { ...created.recovery,
      repairHint: created.issue
        ? `Run issue_repair for provider issue #${created.issue.iid} after creation reconciliation stops retrying.`
        : undefined,
    } : undefined,
    announcementSuffix: created.success
      ? created.role
        ? "\nQueued for heartbeat dispatch."
        : "\nWaiting in the initial hold state. Use task_start when the task is ready for dispatch."
      : "\nCreation is pending reconciliation; the issue is not available to heartbeat or workers.",
  };
}
