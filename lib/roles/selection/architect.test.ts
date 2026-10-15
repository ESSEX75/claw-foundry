/** Verifies built-in architect levels and configured rank/model selection. */

import assert from "node:assert";
import { describe, it } from "node:test";
import type { ResolvedRoleConfig } from "../../state/index.js";
import { getBuiltInLevelsForRole, requireBuiltInRole } from "../built-in/index.js";
import { selectLevel } from "./level-selection.js";
import { resolveModelForLevel } from "./model-resolution.js";

/** Explicit configured architect scale used by selection tests. */
const architectRole: ResolvedRoleConfig = {
  levels: {
    junior: { rank: 1, model: "anthropic/claude-sonnet-4-5", maxWorkers: 2 },
    senior: { rank: 2, model: "anthropic/claude-opus-4-6", maxWorkers: 2 },
  },
  defaultLevel: "junior",
  completion: {},
  enabled: true,
};

describe("architect tiers", () => {
  it("should recognize architect levels", () => {
    assert.strictEqual(getBuiltInLevelsForRole("architect").includes("junior"), true);
    assert.strictEqual(getBuiltInLevelsForRole("architect").includes("senior"), true);
    assert.strictEqual(getBuiltInLevelsForRole("architect").includes("medior"), false);
  });

  it("should resolve default architect models", () => {
    assert.strictEqual(requireBuiltInRole("architect").levels.senior?.model, "anthropic/claude-opus-4-6");
    assert.strictEqual(requireBuiltInRole("architect").levels.junior?.model, "anthropic/claude-sonnet-4-5");
  });

  it("should resolve architect model from resolved role config", () => {
    const resolvedRole: ResolvedRoleConfig = {
      levels: {
        junior: { rank: 1, model: "default/model", maxWorkers: 2 },
        senior: { rank: 2, model: "custom/model", maxWorkers: 2 },
      },
      defaultLevel: "junior",
      completion: {},
      enabled: true,
    };

    assert.strictEqual(resolveModelForLevel("senior", resolvedRole), "custom/model");
  });

  it("should have architect emoji", () => {
    assert.strictEqual(requireBuiltInRole("architect").levels.senior?.emoji, "\u{1f3d7}\u{fe0f}");
    assert.strictEqual(requireBuiltInRole("architect").levels.junior?.emoji, "\u{1f4d0}");
  });
});

describe("architect model selection", () => {
  it("should select junior for standard design tasks", () => {
    const result = selectLevel("Design: Add caching layer", "Simple caching strategy", "architect", architectRole);

    assert.strictEqual(result.level, "junior");
  });

  it("should select senior for complex design tasks", () => {
    const result = selectLevel("Design: System-wide refactor", "Major migration and redesign of the architecture", "architect", architectRole);

    assert.strictEqual(result.level, "senior");
  });
});
