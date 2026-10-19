/** Verifies provider identity and managed projections while preserving independent local blockers. */

import { log as auditLog } from "../../../audit.js";
import { ISSUE_ARCHIVE_REASON, ISSUE_INTEGRITY_STATUS, STATE_TYPE } from "../../../domain/index.js";
import { isProviderIssueLookupError, PROVIDER_ISSUE_LOOKUP_ERROR } from "../../../integrations/index.js";
import { extractIssueMetadata, metadataMatches } from "../../../projection/index.js";
import { isIssueCreationReady, readIssueStateStore, withIssueOrchestrationLock } from "../../../state/index.js";
import { reconcileManagedLabelsLocked } from "../reconciliation/index.js";
import {
  HEARTBEAT_MISSING_CONFIRMATIONS,
  HEARTBEAT_MISSING_DURATION_MS,
  HEARTBEAT_PROJECTION_AUDIT_EVENT,
  HEARTBEAT_PROJECTION_AUDIT_REASON,
  HEARTBEAT_PROJECTION_ERROR,
  HEARTBEAT_PROJECTION_OWNER,
  HEARTBEAT_PROVIDER_DELETED_CORRELATION_PREFIX,
  PROJECTION_INTEGRITY_ACTION,
} from "./const.js";
import { clearProviderMissing, markIntegrityError, recordProviderMissing, setIntegrityStatus } from "./integrity.js";
import type { ProjectionIntegrityInput, ProjectionIntegrityResult } from "./types.js";

/** Check provider identity and metadata under the issue lock before reconciling labels.
 * Only diagnostics verified by this pass can be cleared; unrelated blockers remain.
 * @param opts - Resolved project/provider dependencies and optional observation timestamp.
 */
export async function projectionIntegrityPass(opts: ProjectionIntegrityInput): Promise<ProjectionIntegrityResult> {
  const { workspaceDir, project, provider, workflow, roles } = opts;
  const store = await readIssueStateStore(workspaceDir, project.slug);
  const states = Object.values(store.issues);
  const result: ProjectionIntegrityResult = {
    checked: 0,
    removed: 0,
    repaired: 0,
    errors: 0,
    skipped: 0,
    events: [],
  };

  for (const candidate of states) {
    await withIssueOrchestrationLock(workspaceDir, project.slug, candidate.issueId, async () => {
      const state = (await readIssueStateStore(workspaceDir, project.slug)).issues[String(candidate.issueId)];

      if (!state) return;
      if (!await isIssueCreationReady(workspaceDir, project.slug, state.creationOperationId)) return;
      if (workflow.states[state.workflowState]?.type === STATE_TYPE.TERMINAL
        && await opts.archive.recoverArchivedIssueLocked(workspaceDir, project.slug, state.issueId, workflow)) {
        result.removed++;

        return;
      }

      result.checked++;
      let issue: Awaited<ReturnType<typeof provider.getIssue>>;

      try {
        issue = await provider.getIssue(state.issueId);
      } catch (err) {
        if (isProviderIssueLookupError(err) && err.code === PROVIDER_ISSUE_LOOKUP_ERROR.ISSUE_NOT_FOUND) {
          result.events.push({ issueId: state.issueId, action: PROJECTION_INTEGRITY_ACTION.PROVIDER_MISSING });
          const missing = await recordProviderMissing(workspaceDir, project.slug, state.issueId, opts.now ?? new Date());
          const correlationId = `${HEARTBEAT_PROVIDER_DELETED_CORRELATION_PREFIX}${project.slug}:${state.issueId}`;

          await auditLog(workspaceDir, HEARTBEAT_PROJECTION_AUDIT_EVENT.PROVIDER_DELETED_DETECTED, {
            projectSlug: project.slug,
            issueId: state.issueId,
            provider: state.provider,
            actor: HEARTBEAT_PROJECTION_OWNER.INSPECTION,
            reason: HEARTBEAT_PROJECTION_AUDIT_REASON.ISSUE_NOT_FOUND,
            correlationId,
            confirmations: missing.confirmations,
          });

          const stableMissing = missing.confirmations >= HEARTBEAT_MISSING_CONFIRMATIONS
            && Date.parse(missing.lastConfirmedAt) - Date.parse(missing.firstConfirmedAt) >= HEARTBEAT_MISSING_DURATION_MS;

          if (stableMissing && !state.activeWorker) {
            const archive = await opts.archive.archiveManagedIssueLocked({
              workspaceDir,
              projectSlug: project.slug,
              issueId: state.issueId,
              archiveReason: ISSUE_ARCHIVE_REASON.PROVIDER_DELETED,
              providerDeletedAt: missing.lastConfirmedAt,
              actor: HEARTBEAT_PROJECTION_OWNER.INSPECTION,
              correlationId,
            });

            if (archive.archived) result.removed++;
          } else {
            result.skipped++;
          }

          return;
        }

        result.errors++;
        const message = err instanceof Error ? err.message : String(err);
        const errors = [`${HEARTBEAT_PROJECTION_ERROR.FETCH_PREFIX}${message}`];

        result.events.push({ issueId: state.issueId, action: PROJECTION_INTEGRITY_ACTION.PROVIDER_FETCH_ERROR, errors });
        await markIntegrityError(workspaceDir, project.slug, state.issueId, errors);
        await auditLog(workspaceDir, HEARTBEAT_PROJECTION_AUDIT_EVENT.INTEGRITY_ERROR, {
          projectSlug: project.slug,
          issueId: state.issueId,
          reason: HEARTBEAT_PROJECTION_AUDIT_REASON.PROVIDER_FETCH_ERROR,
          errors,
        });

        return;
      }

      if (state.providerMissing) await clearProviderMissing(workspaceDir, project.slug, state.issueId);

      const metadata = extractIssueMetadata(issue.description ?? "");
      const expectedMetadata = {
        projectSlug: project.slug,
        issueId: state.issueId,
      };

      if (!metadataMatches(metadata, expectedMetadata)) {
        result.errors++;
        const errors = [
          metadata
            ? HEARTBEAT_PROJECTION_ERROR.METADATA_MISMATCH
            : HEARTBEAT_PROJECTION_ERROR.METADATA_MISSING,
        ];

        result.events.push({ issueId: state.issueId, action: PROJECTION_INTEGRITY_ACTION.METADATA_ERROR, errors });
        await markIntegrityError(workspaceDir, project.slug, state.issueId, errors);
        await auditLog(workspaceDir, HEARTBEAT_PROJECTION_AUDIT_EVENT.INTEGRITY_ERROR, {
          projectSlug: project.slug,
          issueId: state.issueId,
          reason: metadata ? HEARTBEAT_PROJECTION_AUDIT_REASON.METADATA_MISMATCH
            : HEARTBEAT_PROJECTION_AUDIT_REASON.METADATA_MISSING,
          errors,
        });

        return;
      }

      const { diff } = await reconcileManagedLabelsLocked({
        workspaceDir,
        projectSlug: project.slug,
        issueId: state.issueId,
        workflow,
        roles,
        provider,
        owner: HEARTBEAT_PROJECTION_OWNER.REPAIR,
      });

      if (diff.missingManagedLabels.length === 0 && diff.unexpectedManagedLabels.length === 0) {
        if (state.integrityStatus !== ISSUE_INTEGRITY_STATUS.OK || state.integrityErrors.length > 0) {
          await setIntegrityStatus(workspaceDir, project.slug, state.issueId, ISSUE_INTEGRITY_STATUS.OK, []);
        }

        return;
      }

      result.repaired++;
      result.events.push({ issueId: state.issueId, action: PROJECTION_INTEGRITY_ACTION.LABEL_REPAIR, diff });
      await setIntegrityStatus(workspaceDir, project.slug, state.issueId, ISSUE_INTEGRITY_STATUS.OK, []);
      await auditLog(workspaceDir, HEARTBEAT_PROJECTION_AUDIT_EVENT.LABEL_REPAIR, {
        projectSlug: project.slug,
        issueId: state.issueId,
        missingManagedLabels: diff.missingManagedLabels,
        unexpectedManagedLabels: diff.unexpectedManagedLabels,
      });
    });
  }

  return result;
}
