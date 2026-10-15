/**
 * sync_labels — Sync GitHub/GitLab labels with the current workflow config.
 *
 * Creates any missing state labels, role:level labels, and step routing labels
 * from the resolved (three-layer merged) config. Use after editing workflow.yaml
 * to push label changes to your issue tracker.
 *
 * Uses the application workflow-label capability with resolved workspace/project overrides.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { syncProjectLabels } from "../../application/index.js";
import type { PluginContext } from "../../context.js";
import { requireWorkspaceDir } from "../helpers.js";
import { requiredTextInput, toolInputParameters } from "../validation/index.js";

/** Validates sync-labels arguments before context resolution or effects. */
const syncLabelsInput = z.strictObject({
  projectSlug: requiredTextInput.describe("Canonical project slug to sync. Omit to sync all registered projects.").optional(),
});

/** Bind label synchronization to plugin-owned transport and application workflow projection.
 * @param ctx - Plugin dependencies used for explicit provider effects.
 */
export function createSyncLabelsTool(ctx: PluginContext): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "sync_labels",
    label: "Sync Labels",
    description:
      "Sync GitHub/GitLab labels with the current workflow config. " +
      "Creates any missing state labels, role:level labels, and step routing labels. " +
      "Use after editing workflow.yaml to push label changes to your issue tracker.",
    parameters: toolInputParameters(syncLabelsInput),

    /** Synchronize the selected registered projects without treating invalid input as all-project scope.
     * @param _id - SDK invocation identifier; synchronization does not depend on it.
     * @param rawParams - Optional exact canonical project selection supplied by the tool boundary.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = syncLabelsInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);

      return jsonResult(await syncProjectLabels({ workspaceDir, projectSlug: params.projectSlug, runCommand: ctx.runCommand }));
    },
  });
}
