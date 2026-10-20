/** Verifies the fake SDK transaction boundary preserves snapshots and serializes mutation failures. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { createSetupRuntime } from "./runtime.js";

it("keeps current configuration and committed history independent from caller mutations", async () => {
  const fixture = createSetupRuntime({ agents: { list: [] } });

  await fixture.runtime.config.mutateConfigFile({ afterWrite: { mode: "none", reason: "fixture test" }, mutate: draft => { draft.agents = { list: [{ id: "one" }] }; } });
  const observed = fixture.runtime.config.current();

  assert.ok(observed.agents?.list);
  Reflect.set(observed.agents.list, "0", { id: "external" });
  fixture.writes[0].nextConfig.agents?.list?.push({ id: "history-edit" });
  assert.deepEqual(fixture.runtime.config.current().agents?.list?.map(agent => agent.id), ["one"]);
  await fixture.runtime.config.mutateConfigFile({ afterWrite: { mode: "none", reason: "fixture test" }, mutate: draft => { draft.agents?.list?.push({ id: "two" }); } });
  assert.deepEqual(fixture.writes[0].nextConfig.agents?.list?.map(agent => agent.id), ["one", "history-edit"]);
});

it("serializes concurrent mutations against committed state and recovers after rejected drafts", async () => {
  const fixture = createSetupRuntime({ agents: { list: [] } });

  await Promise.all(["one", "two"].map(id => fixture.runtime.config.mutateConfigFile({ afterWrite: { mode: "none", reason: "fixture test" }, mutate: async draft => {
    await Promise.resolve();
    draft.agents?.list?.push({ id });
  } })));
  assert.deepEqual(fixture.runtime.config.current().agents?.list?.map(agent => agent.id), ["one", "two"]);
  await assert.rejects(fixture.runtime.config.mutateConfigFile({ afterWrite: { mode: "none", reason: "fixture test" }, mutate: draft => {
    draft.agents?.list?.push({ id: "rejected" });
    throw new Error("mutation failed");
  } }), /mutation failed/);
  await fixture.runtime.config.mutateConfigFile({ afterWrite: { mode: "none", reason: "fixture test" }, mutate: draft => { draft.agents?.list?.push({ id: "three" }); } });
  assert.deepEqual(fixture.runtime.config.current().agents?.list?.map(agent => agent.id), ["one", "two", "three"]);
  assert.equal(fixture.writes.length, 3);
});
