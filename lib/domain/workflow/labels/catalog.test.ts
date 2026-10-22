/** Verifies catalog generation independently of graph traversal and saved issue state. */

import assert from "node:assert/strict";
import { it } from "node:test";
import { getRoleLabels, getStepRoutingLabels } from "./index.js";

it("includes enabled custom role levels and all policy labels without exposing color tables", () => {
  const roles = {
    security_auditor: { levels: { expert: { rank: 1, model: "provider/model" } }, enabled: true },
    disabled: { levels: { junior: { rank: 1, model: "provider/model" } }, enabled: false },
  };

  assert.deepEqual(getRoleLabels(roles), [{ name: "security_auditor:expert", color: "#cccccc" }]);
  assert.deepEqual(getStepRoutingLabels().map(label => label.name).sort(), [
    "review:agent", "review:human", "review:skip", "test:agent", "test:skip",
  ]);
});
