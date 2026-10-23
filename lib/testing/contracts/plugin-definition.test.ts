/** Prevents manifest, runtime registration and heartbeat defaults from drifting apart. */

import assert from "node:assert/strict";
import { it } from "node:test";

import plugin from "../../../index.js";
import manifest from "../../../openclaw.plugin.json" with { type: "json" };
import { HEARTBEAT_DEFAULTS } from "../../application/index.js";

it("registers the manifest identity and the canonical settings schema", () => {
  assert.equal(plugin.id, manifest.id);
  assert.equal(plugin.name, manifest.name);
  assert.deepEqual(plugin.configSchema, manifest.configSchema);
});

it("advertises the heartbeat defaults actually used by the application", () => {
  const fields = manifest.configSchema.properties.work_heartbeat.properties;

  assert.deepEqual({
    enabled: fields.enabled.default,
    intervalSeconds: fields.intervalSeconds.default,
    maxPickupsPerTick: fields.maxPickupsPerTick.default,
  }, HEARTBEAT_DEFAULTS);
});
