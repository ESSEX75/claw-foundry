/**
 * Applies and verifies the provider-visible projection of a created issue.
 */

import { getStateLabels, ISSUE_CREATION_ERROR, ISSUE_CREATION_STATUS } from "../../../domain/index.js";
import {
  composeManagedIssueBody,
  diffIssueProjection,
  extractIssueCreationMarker,
  extractIssueMetadata,
  metadataMatches,
  stripManagedIssueBody,
} from "../../../projection/index.js";
import type { IssueCreationOperation } from "../../../state/index.js";
import { buildInitialIssueRuntimeState } from "../../issue-runtime/index.js";
import { applyManagedLabelDiff } from "../../projection/index.js";
import { CREATION_STEPS } from "./const.js";
import { IssueCreationFailureError } from "./failure.js";
import { completeStep, transitionStatus, updateOperation } from "./record.js";
import type { CreateManagedTaskInput } from "./types.js";

/**
 * Apply managed labels and metadata, then verify provider read-back.
 * Runtime state remains unpublished until this operation persists verification.
 *
 * @param opts - Provider and resolved workflow used for projection.
 * @param operation - Durable operation with a known provider identity.
 */
export async function reconcileCreatedProviderIssue(
  opts: CreateManagedTaskInput,
  operation: IssueCreationOperation,
): Promise<IssueCreationOperation> {
  const providerRef = operation.providerIssue;

  if (!providerRef) throw new Error("Provider identity is missing from provider_created operation.");
  let issue = await opts.provider.getIssue(providerRef.issueId);
  const draft = buildInitialIssueRuntimeState(operation.input, operation.projectSlug, issue.iid);
  const options = { stateLabels: getStateLabels(opts.workflow), roles: opts.roles };
  const diff = diffIssueProjection({
    state: draft,
    actualLabels: issue.labels,
    options,
  });

  await applyManagedLabelDiff({ issueId: issue.iid, provider: opts.provider, diff, workflow: opts.workflow, roles: opts.roles });
  const metadata = { projectSlug: operation.projectSlug, issueId: issue.iid };
  const desiredBody = composeManagedIssueBody(issue.description, metadata, operation.operationId);

  if (desiredBody !== issue.description) {
    await opts.provider.editIssue(issue.iid, { body: desiredBody });
  }

  issue = await opts.provider.getIssue(issue.iid);
  const verifiedDiff = diffIssueProjection({
    state: draft,
    actualLabels: issue.labels,
    options,
  });
  const verifiedMetadata = metadataMatches(extractIssueMetadata(issue.description), metadata);
  const markerMatches = extractIssueCreationMarker(issue.description) === operation.operationId;
  const expectedUserBody = stripManagedIssueBody(operation.input.body).trim();
  const bodyMatches = expectedUserBody === "" || stripManagedIssueBody(issue.description).includes(expectedUserBody);

  if (
    issue.title !== operation.input.title
    || !bodyMatches
    || verifiedDiff.missingManagedLabels.length > 0
    || verifiedDiff.unexpectedManagedLabels.length > 0
    || !verifiedMetadata
    || !markerMatches
  ) {
    throw new IssueCreationFailureError({
      code: ISSUE_CREATION_ERROR.PROJECTION_VERIFICATION_FAILED,
      message: "Provider read-back does not match the expected creation projection.",
      retryable: true,
    });
  }

  return updateOperation(opts, operation.idempotencyKey, (target) => {
    transitionStatus(target, ISSUE_CREATION_STATUS.PROJECTION_VERIFIED);
    completeStep(target, CREATION_STEPS.PROJECTION_VERIFIED);
    target.lastError = undefined;
    target.retryAfter = undefined;
  });
}
