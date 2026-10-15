/** Exercises every registered SDK adapter with malformed input before any context or command effects. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import type { PluginContext } from "../../context.js";
import { toolRegistry } from "../registration/index.js";
import { resolveChannelId } from "../context/index.js";

/** Validates the JSON Schema envelope without assuming an SDK-specific schema type. */
const parameterSchema = z.object({
  type: z.literal("object"),
  additionalProperties: z.literal(false),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), z.unknown()),
});

/** Minimal field shape used to select adversarial values for the public input contract. */
const fieldSchema = z.object({
  type: z.string().optional(),
  pattern: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
});

/** Valid required values; optional arguments are supplied only by the corresponding test. */
const requiredValues: Record<string, unknown> = {
  channel: "telegram", channelId: "chat-1", accountId: "default", project: "test-project",
  issueId: 42, title: "Task", description: "Research background", idempotencyKey: "request-1",
  level: "medior", body: "Comment", role: "developer", result: "blocked", name: "test-project",
  repo: ".", baseBranch: "main", source: "local-state", dryRun: true, action: "diff",
};

describe("registered tool input boundaries", () => {
  for (const entry of toolRegistry) {
    it(`${entry.names[0]} rejects malformed fields before context resolution`, async () => {
      let effects = 0;
      const ctx: PluginContext = {
        runCommand: async () => { effects++; throw new Error("Unexpected command effect"); },
        /** Detect runtime access before malformed input is rejected. */
        get runtime(): never { effects++; throw new Error("Unexpected runtime access"); },
        /** Detect SDK configuration access before malformed input is rejected. */
        get config(): never { effects++; throw new Error("Unexpected config access"); },
        /** Detect logging through plugin capabilities before validation. */
        get logger(): never { effects++; throw new Error("Unexpected logger access"); },
        /** Detect plugin policy lookup before malformed input is rejected. */
        get pluginConfig(): never { effects++; throw new Error("Unexpected plugin config access"); },
      };
      const tool = entry.factory(ctx)({
        config: {},
        /** Detect workspace resolution, including paths that never submit commands. */
        get workspaceDir(): never { effects++; throw new Error("Unexpected workspace access"); },
      });
      assert.ok(tool && !Array.isArray(tool));
      assert.ok(entry.names.some(name => name === tool.name));
      const schema = parameterSchema.parse(tool.parameters);
      const seed: Record<string, unknown> = {};
      for (const key of schema.required ?? []) {
        assert.ok(key in requiredValues, `Missing valid fixture for ${key}`);
        seed[key] = requiredValues[key];
      }
      if (tool.name === "issue_repair") seed.project = "test-project";

      const invalid: Record<string, unknown>[] = [{ ...seed, unexpected: true }];
      for (const key of schema.required ?? []) {
        const omitted = { ...seed };
        delete omitted[key];
        invalid.push(omitted);
      }
      for (const [key, rawField] of Object.entries(schema.properties)) {
        const field = fieldSchema.parse(rawField);
        if (field.type === "boolean") {
          for (const value of ["false", 0, null]) invalid.push({ ...seed, [key]: value });
        } else if (key === "issueId" || key === "confirmIssueId") {
          for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "42"]) {
            invalid.push({ ...seed, [key]: value });
          }
        } else if (field.type === "string") {
          invalid.push({ ...seed, [key]: 42 });
          if (field.pattern) invalid.push({ ...seed, [key]: "" }, { ...seed, [key]: "   " });
          if (field.enum) invalid.push({ ...seed, [key]: "not_a_configured_enum_member" });
        } else if (field.type === "integer") {
          for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "20"]) {
            invalid.push({ ...seed, [key]: value });
          }
        } else if (field.type === "array") {
          invalid.push({ ...seed, [key]: "array" }, { ...seed, [key]: [null] });
          if (key === "issueIds") invalid.push({ ...seed, issueIds: [0] }, { ...seed, issueIds: [Number.MAX_SAFE_INTEGER + 1] });
        } else if (field.type === "object") {
          invalid.push({ ...seed, [key]: [] }, { ...seed, [key]: { developer: { medior: false } } });
        }
      }
      if (tool.name === "work_finish") {
        invalid.push({ ...seed, createdTasks: [{ id: Number.MAX_SAFE_INTEGER + 1, title: "Follow-up", url: "https://example.com" }] });
      }
      if (tool.name === "sync_labels") invalid.push({ channelId: "chat-1" });
      for (const input of invalid) await assert.rejects(tool.execute("invalid", input), z.ZodError);
      assert.equal(effects, 0);
    });
  }

  it("rejects invalid explicit destinations without context fallback", () => {
    for (const value of [42, false, null, "", "   "]) {
      assert.throws(() => resolveChannelId({ config: {} }, value), z.ZodError);
    }
    assert.throws(() => resolveChannelId({ config: {} }), /channelId is required/);
  });
});
