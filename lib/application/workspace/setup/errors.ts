/** Reports partial setup effects without deleting agents or disguising an incomplete apply as success. */

import { SETUP_RECOVERY_ACTION } from "../const.js";
import type { SetupIncompleteResult } from "../types.js";

/** Carries the last known setup result and an actionable recovery target while preserving the original cause. */
export class SetupApplyError extends Error {
  /** Configuration/resource effects confirmed before failure, including recovery instructions. */
  readonly result: SetupIncompleteResult;

  /** Describe a stopped apply while preserving its exact target and cause.
   * @param result - Confirmed partial outcome with the stopped effect and recovery target.
   * @param cause - Original SDK, filesystem or model-write failure.
   */
  constructor(result: SetupIncompleteResult, cause: unknown) {
    const recovery = result.recovery;
    const guidance = recovery.action === SETUP_RECOVERY_ACTION.INSPECT_REGISTRATION
      ? `Registration was not confirmed. Inspect OpenClaw configuration for agent "${result.agentId}" before retrying registration.`
      : recovery.agentId
        ? `Resume setup with agentId="${recovery.agentId}" and workspacePath="${result.workspacePath}", without newAgentName; retain requested binding/model overrides.`
        : `Resume setup with workspacePath="${result.workspacePath}"; retain requested model overrides.`;

    super(`Setup stopped during ${recovery.step}: ${recovery.reason}. ${guidance}`, { cause });
    this.name = "SetupApplyError";
    this.result = result;
  }
}
