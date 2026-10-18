/** Exercises endpoint selection with application eligibility and a deterministic terminal question port. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { createSetupRuntime } from "../../../testing/index.js";
import { collectChannelBinding } from "./binding-prompts.js";

it("offers an agent's own topic, excludes conflicting groups, and returns the exact selected peer", async t => {
  const fixture = createSetupRuntime({ agents: { entries: { owner: {}, foreign: {} } },
    channels: { telegram: { accounts: { account: { groups: { "-100": { topics: { "7": {} } } } } } } },
    bindings: [
      { agentId: "foreign", match: { channel: "telegram", accountId: "account", peer: { kind: "group", id: "-100" } } },
      { agentId: "owner", match: { channel: "telegram", accountId: "account", peer: { kind: "group", id: "-100:topic:7" } } },
    ] });
  const lines: string[] = [];
  t.mock.method(console, "log", (line: string) => { lines.push(line); });
  const result = await collectChannelBinding({ question: async () => "1" }, fixture.runtime, { agent: "owner" });

  assert.deepEqual(result, { channelBinding: "telegram", channelAccountId: "account", channelPeerId: "-100:topic:7" });
  assert.ok(lines.some(line => line.includes("1. telegram / account / -100:topic:7")));
  assert.deepEqual(fixture.writes, []);
  assert.deepEqual(fixture.commands, []);
});

it("offers none when no endpoints exist and rejects an invalid terminal selection", async t => {
  const fixture = createSetupRuntime({ agents: { entries: { owner: {} } } });
  t.mock.method(console, "log", () => {});

  assert.deepEqual(await collectChannelBinding({ question: async () => "" }, fixture.runtime, { agent: "owner" }), { channelBinding: "none" });
  await assert.rejects(collectChannelBinding({ question: async () => "2" }, fixture.runtime, { agent: "owner" }), /Invalid channel account option/);
});

it("propagates configuration failures before asking for a choice", async () => {
  const fixture = createSetupRuntime();
  const cause = new Error("SDK config unavailable");

  fixture.runtime.config.current = () => { throw cause; };
  await assert.rejects(collectChannelBinding({ question: async () => { throw new Error("must not ask"); } }, fixture.runtime, { agent: "owner" }),
    error => error === cause);
});
