/**
 * workflow_guide — Reference tool for editing workflow.yaml.
 *
 * Returns a comprehensive guide explaining the workflow config structure,
 * all enums/constrained values, the three-layer config system, and
 * common customization recipes. Designed to be read by an LLM before
 * it edits any workflow.yaml file.
 *
 * Optional topic selection, no side effects — pure documentation.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";

import { DATA_DIR } from "../../state/index.js";
import { requireWorkspaceDir } from "../context/index.js";
import { toolInputParameters } from "../validation/index.js";
import { WORKFLOW_GUIDE_TOOL_NAME } from "./const.js";
import { buildWorkflowGuideSections } from "./content.js";
import { workflowGuideInput } from "./schema.js";

/** Create the workflow guide SDK adapter with validated command input. */
export function createWorkflowGuideTool(): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: WORKFLOW_GUIDE_TOOL_NAME,
    label: "Workflow Guide",
    description:
      `Reference guide for editing workflow.yaml. ` +
      `Call this BEFORE making any workflow configuration changes. ` +
      `Returns the full config structure, all valid values (enums, free-form fields), ` +
      `the three-layer override system, and common recipes like enabling the test phase ` +
      `or changing the review policy.`,
    parameters: toolInputParameters(workflowGuideInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = workflowGuideInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const dataDir = `${workspaceDir}/${DATA_DIR}`;
      const topic = params.topic;

      const sections = buildWorkflowGuideSections(dataDir);

      if (topic !== undefined) {
        return jsonResult({ guide: sections[topic] });
      }

      // Full guide
      const full = Object.values(sections).join("\n\n---\n\n");

      return jsonResult({ guide: full });
    },
  });
}
