/** Provisions workflow, configured role/level and policy label definitions without touching issues. */

import { getRoleLabels, getStateLabels, getStepRoutingLabels } from "../../domain/index.js";
import { ensureWorkflowLabels } from "../projection/index.js";
import type { LabelCatalog, ProvisionLabelCatalogInput } from "./types.js";

/** Ensure the complete resolved catalog; a partial failure propagates and the same request can be repeated.
 * This operation neither lists issues nor reconciles their labels, body metadata or local state.
 * @param input - Explicit provider definition capability and resolved configuration.
 */
export async function provisionLabelCatalog(input: ProvisionLabelCatalogInput): Promise<LabelCatalog> {
  const roleLabels = getRoleLabels(input.roles);
  const routingLabels = getStepRoutingLabels();

  await ensureWorkflowLabels(input.provider, input.workflow);
  for (const label of [...roleLabels, ...routingLabels]) await input.provider.ensureLabel(label.name, label.color);

  return { stateLabels: getStateLabels(input.workflow), roleLabels: roleLabels.map(label => label.name),
    routingLabels: routingLabels.map(label => label.name) };
}
