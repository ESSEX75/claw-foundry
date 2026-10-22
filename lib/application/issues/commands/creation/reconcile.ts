/**
 * Resumes bounded unfinished creation operations during heartbeat passes.
 */

import { ISSUE_CREATION_STATUS, readIssueCreationStore, withIssueCreationLock } from "../../../../state/index.js";
import { creationAudit } from "./audit.js";
import { CREATION_EVENT, CREATION_RECONCILIATION_REQUESTER, CREATION_RECOVERY_ELIGIBILITY, CREATION_RESULT_STATUS } from "./const.js";
import { creationRecoveryEligibility } from "./eligibility.js";
import { withCreationPermit } from "./permit.js";
import { updateOperation } from "./record.js";
import { runCreationOperation } from "./runner.js";
import type { ReconcileManagedTaskCreationsInput, ReconcileManagedTaskCreationsResult } from "./types.js";

/**
 * Reconcile bounded unfinished creation operations during heartbeat passes.
 * Runnable operations are re-read after acquiring their idempotency lock; waiting/manual
 * entries are snapshot observations and consume no work budget. Persisted attempt counts rotate retries.
 *
 * @param opts - Project, provider, workflow, and maximum pass size.
 */
export async function reconcileManagedTaskCreations(opts: ReconcileManagedTaskCreationsInput): Promise<ReconcileManagedTaskCreationsResult> {
  const limit = Math.max(0, Math.floor(opts.maxItems));

  if (!Number.isFinite(limit)) throw new Error("Creation reconciliation maxItems must be finite.");
  if (limit === 0) return { ready: [], pending: [], manual: [], waiting: [] };
  const store = await readIssueCreationStore(opts.workspaceDir, opts.project.slug);
  const operations = Object.values(store.operations)
    .filter((operation) => operation.status !== ISSUE_CREATION_STATUS.READY)
    .sort((a, b) => (a.reconciliationAttempts ?? 0) - (b.reconciliationAttempts ?? 0)
      || a.updatedAt.localeCompare(b.updatedAt) || a.idempotencyKey.localeCompare(b.idempotencyKey));
  const ready: number[] = [];
  const pending: string[] = [];
  const manual: string[] = [];
  const waiting: string[] = [];
  let attempted = 0;

  for (const operation of operations) {
    const eligibility = creationRecoveryEligibility(operation, Date.now());

    if (eligibility === CREATION_RECOVERY_ELIGIBILITY.MANUAL) {
      manual.push(operation.operationId);
      continue;
    }

    if (eligibility === CREATION_RECOVERY_ELIGIBILITY.WAITING) {
      waiting.push(operation.operationId);
      continue;
    }

    if (attempted >= limit) continue;
    await withIssueCreationLock(opts.workspaceDir, opts.project.slug, operation.idempotencyKey, async () => {
      let current = (await readIssueCreationStore(opts.workspaceDir, opts.project.slug)).operations[operation.idempotencyKey];

      if (!current || (current.reconciliationAttempts ?? 0) > (operation.reconciliationAttempts ?? 0)) return;
      const freshEligibility = creationRecoveryEligibility(current, Date.now());

      if (freshEligibility === CREATION_RECOVERY_ELIGIBILITY.READY) return;
      if (freshEligibility === CREATION_RECOVERY_ELIGIBILITY.MANUAL) {
        manual.push(current.operationId);

        return;
      }

      if (freshEligibility === CREATION_RECOVERY_ELIGIBILITY.WAITING) {
        waiting.push(current.operationId);

        return;
      }

      current = await updateOperation(opts, current.idempotencyKey, target => {
        target.reconciliationAttempts = (target.reconciliationAttempts ?? 0) + 1;
      });
      attempted++;
      const operationOpts = {
        ...opts,
        title: current.input.title,
        description: current.input.body,
        assignees: current.input.assignees,
        notifyTarget: current.input.notifyTarget,
        owner: current.input.owner,
        idempotencyKey: current.idempotencyKey,
        requestedBy: CREATION_RECONCILIATION_REQUESTER,
        workflowState: current.input.workflowState,
        assignedRole: current.input.assignedRole,
        assignedLevel: current.input.assignedLevel,
      };

      await creationAudit(operationOpts, current, CREATION_EVENT.RECONCILIATION_SCHEDULED);
      const result = await withCreationPermit(
        `${opts.providerType}:${opts.project.slug}`,
        () => runCreationOperation(operationOpts, current, true),
      );

      if (result.success && result.issue) ready.push(result.issue.iid);
      else if (result.status === CREATION_RESULT_STATUS.MANUAL_REPAIR_REQUIRED || result.status === CREATION_RESULT_STATUS.FAILED) manual.push(result.operationId);
      else pending.push(result.operationId);
    });
  }

  return { ready, pending, manual, waiting };
}
