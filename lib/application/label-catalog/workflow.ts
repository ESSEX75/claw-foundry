/** Provisions workflow label definitions without scanning or reconciling individual issues. */

import { getLabelColors, getStateLabels, type WorkflowConfig } from "../../domain/index.js";
import type { LabelProjector } from "../../integrations/index.js";

/** Ensure the exact labels and colors selected by the resolved workflow.
 * @param provider - Explicit provider label capability.
 * @param workflow - Application-resolved configuration, including custom states.
 */
export async function ensureWorkflowLabels(provider: Pick<LabelProjector, "ensureLabel">, workflow: WorkflowConfig): Promise<void> {
  const colors = getLabelColors(workflow);

  for (const label of getStateLabels(workflow)) {
    const color = colors.get(label);

    if (!color) throw new Error(`No color configured for workflow label "${label}".`);
    await provider.ensureLabel(label, color);
  }
}