/** Owns a managed task lifecycle operation or its pure transition decision. */

import { findSlotByIssue, ISSUE_INTEGRITY_STATUS, STATE_TYPE } from "../../../../domain/index.js";
import { getErrorMessage } from "../../../../errors/index.js";
import { isIssueCreationReady, readIssueStateStore, readProjects, readWorkerDeliveryResolution, withIssueOrchestrationLock } from "../../../../state/index.js";
import { reconcileManagedLabelsLocked } from "../../projection/index.js";
import { writeIssueRuntimeState } from "../../runtime/index.js";
import { TASK_CLAIM_OWNER } from "./const.js";
import type { ClaimManagedTaskInput, ClaimManagedTaskResult } from "./types.js";

/** Transfer issue ownership under the orchestration lock only after creation is ready.
 * @param input - Validated command dependencies and requested changes.
 */
export async function claimManagedTask(input: ClaimManagedTaskInput): Promise<ClaimManagedTaskResult> {
  return withIssueOrchestrationLock(
    input.workspaceDir,
    input.project.slug,
    input.issueId,
    async () => {
      const store = await readIssueStateStore(input.workspaceDir, input.project.slug);
      const state = store.issues[String(input.issueId)];

      if (!state) return { claimed: false, reason: "Local issue state is not initialized" };
      if (!await isIssueCreationReady(input.workspaceDir, input.project.slug, state.creationOperationId)) {
        return { claimed: false, reason: "Issue creation is not ready" };
      }

      if (state.pendingWorkerRelease) return { claimed: false, reason: "Issue has a pending worker release" };
      const resolution = await readWorkerDeliveryResolution(input.workspaceDir, input.project.slug, input.issueId);

      if (resolution && !resolution.completed) return { claimed: false, reason: "Issue has a pending worker delivery resolution" };

      if (input.queuedOnly) {
        const configured = Object.hasOwn(input.workflow.states, state.workflowState)
          ? input.workflow.states[state.workflowState] : undefined;

        if (configured?.type !== STATE_TYPE.QUEUE || configured.label !== state.workflowLabel
          || state.activeWorker || state.pendingWorkerRelease || state.providerMissing) {
          return { claimed: false, reason: "Issue is no longer an available local queue candidate" };
        }

        const project = (await readProjects(input.workspaceDir)).projects[input.project.slug];

        if (!project) return { claimed: false, reason: "Project is no longer registered" };
        if (Object.values(project.workers).some(worker => findSlotByIssue(worker, input.issueId) !== null)) {
          return { claimed: false, reason: "Issue is reserved by a project worker slot" };
        }
      }

      if (state.owner === input.instanceName) {
        await reconcileClaimProjection(input);

        return { claimed: false, reason: "Already owned by this instance; labels reconciled" };
      }

      if (input.queuedOnly && state.integrityStatus === ISSUE_INTEGRITY_STATUS.INTEGRITY_ERROR) {
        return { claimed: false, reason: "Local issue integrity requires repair" };
      }

      if (state.owner && !input.force) {
        return { claimed: false, reason: `Owned by "${state.owner}". Use force=true to transfer.` };
      }

      const issue = await input.provider.getIssue(input.issueId);

      await writeIssueRuntimeState({
        workspaceDir: input.workspaceDir,
        project: input.project,
        issue,
        providerType: input.providerType,
        workflow: input.workflow,
        workflowLabel: state.workflowLabel,
        workflowState: state.workflowState,
        owner: input.instanceName,
      });
      await reconcileClaimProjection(input);

      return { claimed: true };
    },
  );
}

/** Resume idempotent labels from committed local ownership without pretending provider effects are atomic.
 * @param input - Locked issue identity and resolved provider dependencies.
 */
async function reconcileClaimProjection(input: ClaimManagedTaskInput): Promise<void> {
  try {
    await reconcileManagedLabelsLocked({
      workspaceDir: input.workspaceDir, projectSlug: input.project.slug, issueId: input.issueId,
      workflow: input.workflow, roles: input.roles, provider: input.provider, owner: TASK_CLAIM_OWNER,
    });
  } catch (error) {
    throw new Error(`Ownership saved locally; label projection failed: ${getErrorMessage(error)}`, { cause: error });
  }
}
