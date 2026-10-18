/** Exercises the tools public API and exact SDK registration names without permitting effects. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { PluginContext } from "../context.js";
import { toolRegistry } from "../tools/index.js";

/** Stable public tool names consumed by installed OpenClaw configurations. */
const EXPECTED_NAMES = [
  "task_start", "work_finish", "task_create", "task_edit_body", "task_comment", "task_attach",
  "task_set_level", "task_owner", "research_task", "issue_repair", "issue_policy_migrate", "issue_delete",
  "task_list", "tasks_status", "project_status", "project_register", "health", "sync_labels",
  "channel_link", "channel_unlink", "channel_list", "setup", "onboard", "workflow_guide", "config",
];

describe("tools public registration API", () => {
  it("materializes all 25 factories with their exact declared names and no context or provider effects", () => {
    const ctx: PluginContext = {
      runCommand: async () => { throw new Error("Unexpected provider command"); },
      /** Factory construction cannot depend on a particular runtime invocation. */
      get runtime(): never { throw new Error("Unexpected runtime access"); },
      /** Configuration is resolved only when executing a command. */
      get config(): never { throw new Error("Unexpected configuration access"); },
      /** Schema construction has no diagnostic side effects. */
      get logger(): never { throw new Error("Unexpected logging"); },
      /** Plugin policy is consumed only by execution. */
      get pluginConfig(): never { throw new Error("Unexpected policy access"); },
    };
    const names = toolRegistry.flatMap(entry => [...entry.names]);
    assert.deepEqual(names, EXPECTED_NAMES);
    assert.equal(new Set(names).size, EXPECTED_NAMES.length);
    for (const entry of toolRegistry) {
      const tool = entry.factory(ctx)({ config: {} });
      assert.ok(tool && !Array.isArray(tool));
      assert.deepEqual([...entry.names], [tool.name]);
      assert.equal(typeof tool.execute, "function");
      const schema = z.fromJSONSchema(z.record(z.string(), z.unknown()).parse(tool.parameters));
      const description = tool.description;
      const inlineExamples = [...description.matchAll(/\{[^\r\n{}]*\}/g)]
        .map(match => match[0]).filter(example => /^\{\s*\w+\s*:/.test(example))
        .map(example => example.replace(/([,{]\s*)(\w+)\s*:/g, '$1"$2":'));
      const jsonExamples = [...description.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map(match => match[1]);
      for (const example of [...inlineExamples, ...jsonExamples]) schema.parse(JSON.parse(example));
    }
  });
});
