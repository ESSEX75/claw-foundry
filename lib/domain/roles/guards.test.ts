/** Verifies built-in membership while retaining extensible role and level contracts. */

import assert from "node:assert/strict";
import { it } from "node:test";
import {
  DEFAULT_LEVELS,
  DEFAULT_ROLES,
  isBuiltInLevelId,
  isBuiltInRoleId,
  type RoleDefinition,
} from "./index.js";

it("distinguishes built-ins from valid custom role and level identifiers", () => {
  for (const role of Object.values(DEFAULT_ROLES)) assert.equal(isBuiltInRoleId(role), true);
  for (const level of Object.values(DEFAULT_LEVELS)) assert.equal(isBuiltInLevelId(level), true);
  assert.equal(isBuiltInRoleId("security_auditor"), false);
  assert.equal(isBuiltInLevelId("expert"), false);
  const custom: RoleDefinition<"expert"> = { levels: { expert: { rank: 1, model: "provider/model" } }, enabled: true };

  assert.equal(custom.levels.expert.model, "provider/model");
  for (const value of [null, undefined, 1, {}]) {
    assert.equal(isBuiltInRoleId(value), false);
    assert.equal(isBuiltInLevelId(value), false);
  }
});
