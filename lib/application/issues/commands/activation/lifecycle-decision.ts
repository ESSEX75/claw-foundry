/** Owns a managed task lifecycle operation or its pure transition decision. */

import { resolveRoleLevel } from "../../../../roles/index.js";
import { resolveHoldQueueTarget } from "../prerequisites/index.js";
import type { ResolveStartTaskDecisionInput, StartTaskDecision } from "./types.js";

/** Plan the configured approval transition and select a valid worker level.
 * @param input - Validated command dependencies and requested changes.
 */
export function resolveStartTaskDecision(input: ResolveStartTaskDecisionInput): StartTaskDecision {
  const target = resolveHoldQueueTarget(input.workflow, input.currentState);
  const targetRole = target.state.role;
  const roleConfig = input.roles[targetRole];

  if (!roleConfig) throw new Error(`Target role "${targetRole}" is not configured.`);

  return {
    fromStateKey: input.runtimeState.workflowState,
    fromLabel: input.runtimeState.workflowLabel,
    targetStateKey: target.stateKey,
    targetLabel: target.state.label,
    targetRole,
    assignedLevel: resolveRoleLevel({
      requestedLevel: input.requestedLevel,
      runtimeState: input.runtimeState,
      targetRole,
      roleConfig,
      issueTitle: input.issueTitle,
      issueDescription: input.issueDescription,
    }),
  };
}
