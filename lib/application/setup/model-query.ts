/** Exposes effective setup models using the same read-only target planning as the configuration command. */

import { planSetup } from "./setup-plan.js";
import type { ModelConfig, SetupModelQueryInput } from "./types.js";

/** Resolve enabled configured role-level assignments without writes, scope requests, or model discovery.
 * @param input - Existing agent, proposed agent, or explicit workspace selected by the operator.
 */
export async function getSetupModels(input: SetupModelQueryInput): Promise<ModelConfig> {
  return (await planSetup({ ...input, dryRun: true })).models;
}
