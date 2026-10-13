/**
 * Renders provider labels exclusively from authoritative local issue fields.
 */

import { getNotifyLabel, type IssueRuntimeState, OWNER_LABEL_PREFIX, POLICY_LABEL_PREFIX } from "../../domain/index.js";

/** Render managed labels from authoritative local fields without provider observations.
 * @param state - Initialized local issue whose workflow and routing fields are authoritative.
 */
export function expectedManagedLabels(state: IssueRuntimeState): string[] {
  const labels = new Set<string>();

  labels.add(state.workflowLabel);

  if (state.assignedRole && state.assignedLevel) {
    labels.add(`${state.assignedRole}:${state.assignedLevel}`);
  }

  if (state.owner) labels.add(`${OWNER_LABEL_PREFIX}${state.owner}`);
  //TODO: The behavior of the tester, reviewer, etc. is hard-coded.
  if (state.reviewPolicy) labels.add(`${POLICY_LABEL_PREFIX.REVIEW}${state.reviewPolicy}`);
  if (state.testPolicy) labels.add(`${POLICY_LABEL_PREFIX.TEST}${state.testPolicy}`);
  if (state.notifyTarget) labels.add(getNotifyLabel(state.notifyTarget));

  return [...labels].filter(Boolean).sort();
}
