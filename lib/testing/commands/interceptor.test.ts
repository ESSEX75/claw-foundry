/** Verifies invocation evidence survives caller mutations and malformed gateway payloads. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { createCommandInterceptor } from "./interceptor.js";

it("captures command arguments and options at invocation time", async () => {
  const { handler, interceptor } = createCommandInterceptor();
  const argv = ["openclaw", "gateway", "call", "agent", "--params", JSON.stringify({ message: "task", model: "provider/model" })];
  const options = { timeoutMs: 100, cwd: "original" };

  await handler(argv, options);
  argv[0] = "changed";
  options.cwd = "changed";
  assert.equal(interceptor.commandsFor("openclaw").length, 1);
  assert.equal(interceptor.commands[0].opts.cwd, "original");
  assert.deepEqual(interceptor.taskMessages(), ["task"]);
  assert.deepEqual(interceptor.agentModels(), ["provider/model"]);
});

it("rejects malformed session metadata without crashing or fabricating a resolved patch", async () => {
  const { handler, interceptor } = createCommandInterceptor();

  for (const params of [null, [], { key: "session" }, { key: "session", model: 42 }, { key: "session", model: "valid", label: {} }]) {
    const response = await handler(["openclaw", "gateway", "call", "sessions.patch", "--params", JSON.stringify(params)], 100);

    assert.deepEqual(JSON.parse(response.stdout), {});
  }
  assert.deepEqual(interceptor.sessionPatches(), []);
  await handler(["openclaw", "gateway", "call", "sessions.patch", "--params", '{"key":"session","model":"provider/model"}'], 100);
  assert.equal(interceptor.sessionPatches()[0].model, "provider/model");
});
