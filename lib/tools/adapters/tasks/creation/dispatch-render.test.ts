/** Verifies dispatch presentation remains independent of worker input and transport decisions. */

import assert from "node:assert/strict";
import { it } from "node:test";

import type { DispatchResult } from "../../../../application/index.js";
import { WORKER_SESSION_ACTION } from "../../../../domain/index.js";
import { AGENT_TURN_STATUS } from "../../../../integrations/index.js";
import { renderDispatchAnnouncement } from "./dispatch-render.js";

it("preserves custom-role presentation for spawned and reused sessions", () => {
  const result: DispatchResult = { deliveryId: "turn", sessionAction: WORKER_SESSION_ACTION.SPAWN, sessionKey: "session",
    level: "expert", model: "test/model", role: "auditor", issueId: 42, issueTitle: "Audit", issueUrl: "https://example.test/42",
    botName: "Ada", emoji: "🔎", deliveryStatus: AGENT_TURN_STATUS.ACCEPTED };

  assert.equal(renderDispatchAnnouncement(result),
    "🔎 Spawning AUDITOR Ada (expert) for #42: Audit\n📋 [Issue #42](https://example.test/42)");
  assert.equal(renderDispatchAnnouncement({ ...result, sessionAction: WORKER_SESSION_ACTION.SEND, botName: undefined }),
    "🔎 Sending AUDITOR (expert) for #42: Audit\n📋 [Issue #42](https://example.test/42)");
});
