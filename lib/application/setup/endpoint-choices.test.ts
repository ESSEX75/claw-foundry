/** Verifies target-aware endpoint discovery, shared planned-route policy, and fresh apply validation. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSetupRuntime } from "../../testing/index.js";
import { CONFIG_RELOAD_MODE } from "./const.js";
import { getSetupEndpointChoices } from "./endpoint-choices.js";
import { ensureChannelBinding } from "./bindings/index.js";

describe("setup endpoint discovery", () => {
  it("retains own group/topic bindings and excludes foreign owners with exact kind/account matching", () => {
    const fixture = createSetupRuntime({
      agents: { entries: { owner: {}, foreign: {} } },
      channels: { telegram: { accounts: { account: { groups: {
        "-100": { topics: { "1": {}, "2": {}, "3": {} } },
        "-200": {},
      } } } } },
      bindings: [
        { agentId: "owner", match: { channel: "telegram", accountId: "account", peer: { kind: "group", id: "-100" } } },
        { agentId: "owner", match: { channel: "telegram", accountId: "account", peer: { kind: "group", id: "-100:topic:1" } } },
        { agentId: "foreign", match: { channel: "telegram", accountId: "account", peer: { kind: "group", id: "-100:topic:2" } } },
        { agentId: "owner", match: { channel: "telegram", accountId: "account", peer: { kind: "group", id: "-100:topic:3" } } },
        { agentId: "foreign", match: { channel: "telegram", accountId: "account", peer: { kind: "group", id: "-100:topic:3" } } },
        { agentId: "foreign", match: { channel: "telegram", accountId: "account", peer: { kind: "channel", id: "-200" } } },
      ],
    });
    const before = structuredClone(fixture.runtime.config.current());

    assert.deepEqual(getSetupEndpointChoices({ ...fixture, agentId: "owner" }).map(choice => choice.peerId), ["-100", "-100:topic:1"]);
    assert.deepEqual(fixture.runtime.config.current(), before);
    assert.deepEqual(fixture.writes, []);
    assert.deepEqual(fixture.commands, []);
  });

  it("excludes disabled channels/accounts and wildcards while preserving valid independent accounts", () => {
    const fixture = createSetupRuntime({ agents: { entries: { owner: {} } }, channels: {
      telegram: { accounts: {
        disabled: { enabled: false, groups: { "-100": {} } },
        active: { groups: { "*": { topics: { "1": {} } }, "-100": { topics: { "*": {}, "7": {} } } } },
      } },
      whatsapp: { enabled: false, accounts: { disabledChannel: { groups: { chat: {} } } } },
    } });

    assert.deepEqual(getSetupEndpointChoices({ ...fixture, agentId: "owner" }), [
      { channel: "telegram", accountId: "active", peerId: "-100" },
      { channel: "telegram", accountId: "active", peerId: "-100:topic:7" },
    ]);
  });

  it("plans a normalized new agent without modifying either registry representation", () => {
    for (const agents of [{ entries: {} }, { list: [{ id: "owner" }] }]) {
      const fixture = createSetupRuntime({ agents, channels: { telegram: { accounts: { account: { groups: { "-100": {} } } } } } });
      const before = structuredClone(fixture.runtime.config.current());

      assert.equal(getSetupEndpointChoices({ ...fixture, newAgentName: "New Agent" }).length, 1);
      assert.deepEqual(fixture.runtime.config.current(), before);
      assert.deepEqual(fixture.writes, []);
      assert.deepEqual(fixture.commands, []);
    }
  });

  it("rejects ambiguous or missing targets and never resurrects inactive registry entries", () => {
    const fixture = createSetupRuntime({ agents: { entries: { owner: {} }, list: [{ id: "legacy" }] } });

    assert.throws(() => getSetupEndpointChoices(fixture), /requires an existing or proposed agent/);
    assert.throws(() => getSetupEndpointChoices({ ...fixture, agentId: "owner", newAgentName: "New" }), /cannot be combined/);
    assert.throws(() => getSetupEndpointChoices({ ...fixture, agentId: "legacy" }), /does not exist/);
    assert.throws(() => getSetupEndpointChoices({ ...fixture, newAgentName: "Owner" }), /already exists/);
    assert.throws(() => getSetupEndpointChoices({ ...fixture, newAgentName: "main" }), /reserved/);
  });

  it("distinguishes an empty endpoint inventory from a configuration read failure", () => {
    const fixture = createSetupRuntime({ agents: { entries: { owner: {} } } });
    assert.deepEqual(getSetupEndpointChoices({ ...fixture, agentId: "owner" }), []);
    const cause = new Error("SDK config unavailable");

    fixture.runtime.config.current = () => { throw cause; };
    assert.throws(() => getSetupEndpointChoices({ ...fixture, agentId: "owner" }), error => error === cause);
  });

  it("rejects stale menu choices when account availability or exact ownership changes before apply", async () => {
    const fixture = createSetupRuntime({ agents: { entries: { owner: {}, foreign: {} } },
      channels: { telegram: { accounts: { account: { groups: { "-100": {} } } } } } });
    const choice = getSetupEndpointChoices({ ...fixture, agentId: "owner" })[0];
    assert.ok(choice);

    await fixture.runtime.config.mutateConfigFile({
      /** Simulate an independently committed competing owner.
       * @param config - Fresh fixture configuration draft.
       */
      mutate(config) {
        config.bindings = [{ agentId: "foreign", match: { channel: choice.channel, accountId: choice.accountId, peer: { kind: "group", id: choice.peerId } } }];
      },
      afterWrite: { mode: CONFIG_RELOAD_MODE.NONE, reason: "Test fixture update" },
    });
    await assert.rejects(ensureChannelBinding(fixture.runtime, choice.channel, "owner", choice.accountId, choice.peerId), /already bound/);
    assert.equal(fixture.writes.length, 1);
    await fixture.runtime.config.mutateConfigFile({
      /** Simulate channel account disablement after menu selection.
       * @param config - Fresh fixture configuration draft.
       */
      mutate(config) {
        config.bindings = [];
        const account = config.channels?.telegram?.accounts?.account;
        assert.ok(account);
        account.enabled = false;
      },
      afterWrite: { mode: CONFIG_RELOAD_MODE.NONE, reason: "Test fixture update" },
    });
    await assert.rejects(ensureChannelBinding(fixture.runtime, choice.channel, "owner", choice.accountId, choice.peerId), /disabled/);
    assert.equal(fixture.writes.length, 2);
  });
});
