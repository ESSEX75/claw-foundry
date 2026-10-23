/** Verifies bounded warning delivery and isolation from host logger failures. */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { it } from "node:test";

import { configureAuditWarnings, log } from "../index.js";
import { AUDIT_WARNING_INTERVAL_MS } from "./const.js";

it("rate-limits warning attempts across workspaces without exposing event payloads", async t => {
  const messages: string[] = [];
  let now = 1_000;

  t.after(() => { configureAuditWarnings(); });
  t.mock.method(performance, "now", () => now);
  configureAuditWarnings(message => { messages.push(message); });
  await Promise.all(Array.from({ length: 5 }, (_, index) => log(`workspace-${index}`, "failure", { value: 1n, secret: "DO_NOT_LOG" })));
  assert.equal(messages.length, 1);
  assert.match(messages[0] ?? "", /Claw Foundry audit/);
  assert.doesNotMatch(messages[0] ?? "", /DO_NOT_LOG/);
  now += AUDIT_WARNING_INTERVAL_MS;
  await log("workspace-next", "failure", { value: 1n });
  assert.equal(messages.length, 2);
});

it("suppresses synchronous and asynchronous logger failures while throttling broken sinks", async t => {
  let attempts = 0;

  t.after(() => { configureAuditWarnings(); });
  configureAuditWarnings(() => { attempts++; throw new Error("logger failed"); });
  await assert.doesNotReject(log("unused", "bad", { value: 1n }));
  await assert.doesNotReject(log("unused", "bad", { value: 1n }));
  assert.equal(attempts, 1);
  configureAuditWarnings(async () => { attempts++; throw new Error("async logger failed"); });
  await assert.doesNotReject(log("unused", "bad", { value: 1n }));
  assert.equal(attempts, 2);
});

it("does not block an application operation on an unfinished asynchronous warning sink", { timeout: 1_000 }, async t => {
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });

  t.after(() => { release(); configureAuditWarnings(); });
  configureAuditWarnings(() => pending);
  await assert.doesNotReject(log("unused", "bad", { value: 1n }));
});
