/** Checks executable guide examples against the actual SDK schemas and runtime validation. */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { z } from "zod";
import type { PluginContext } from "../../context.js";
import { createIssuePolicyMigrationTool } from "../issues/issue-policy-migrate.js";
import { createSyncLabelsTool } from "./sync-labels.js";
import { createWorkflowGuideTool } from "./workflow-guide.js";

/** User documentation whose tool examples share the executable guide contract. */
const DOCUMENT_URLS = [new URL("../../../docs/WORKFLOW.md", import.meta.url), new URL("../../../docs/TOOLS.md", import.meta.url)];

/** Runtime access marker proving an example passed boundary parsing without allowing effects. */
const VALID_EXAMPLE_RUNTIME = "valid-example-runtime";

/** Provider capabilities must stay untouched while validating guide examples. */
const pluginContext: PluginContext = {
  runCommand: async () => { throw new Error("Unexpected provider command"); },
  /** Detect accidental access while reading schemas. */
  get runtime(): never { throw new Error("Unexpected runtime"); },
  /** Detect accidental access while reading schemas. */
  get config(): never { throw new Error("Unexpected configuration"); },
  /** Detect accidental logging effects. */
  get logger(): never { throw new Error("Unexpected logger"); },
  /** Detect accidental access while reading schemas. */
  get pluginConfig(): never { throw new Error("Unexpected plugin policy"); },
};

describe("workflow guide contract", () => {
  it("validates guide and documentation JSON examples using its SDK schema and actual execute parser", async () => {
    const guideTool = createWorkflowGuideTool()({ config: {}, workspaceDir: "C:/workspace" });
    assert.ok(guideTool && !Array.isArray(guideTool));
    const result = await guideTool.execute("guide", {});
    const { guide } = z.object({ guide: z.string() }).parse(result.details);
    const toolContext = { config: {},
      /** Stop valid execution immediately after parsing, before reading any workspace files. */
      get workspaceDir(): never { throw new Error(VALID_EXAMPLE_RUNTIME); },
    };
    const syncTool = createSyncLabelsTool(pluginContext)(toolContext);
    const policyTool = createIssuePolicyMigrationTool(pluginContext)(toolContext);
    assert.ok(syncTool && !Array.isArray(syncTool));
    assert.ok(policyTool && !Array.isArray(policyTool));
    const documents = await Promise.all(DOCUMENT_URLS.map(url => readFile(url, "utf8")));
    const examples = [guide, ...documents].flatMap(source => [...source.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)]);
    assert.equal(examples.length, 8);
    for (const match of examples) {
      const args = z.record(z.string(), z.unknown()).parse(JSON.parse(match[1]));
      const tool = Object.hasOwn(args, "projectSlug") ? syncTool : policyTool;
      z.fromJSONSchema(z.record(z.string(), z.unknown()).parse(tool.parameters)).parse(args);
      await assert.rejects(async () => tool.execute("example", args), { message: VALID_EXAMPLE_RUNTIME });
    }
    assert.doesNotMatch(guide, /sync_labels channelId=|labels are applied.*override the global|worker gets a generic system prompt/);
  });
});
