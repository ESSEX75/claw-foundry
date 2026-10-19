/** Verifies canonical workflow-edge resolution and configuration snapshot isolation. */

import assert from "node:assert/strict";
import { it } from "node:test";

import { ACTION, resolveCompletionTransition, resolveQueuePickup, resolveWorkflowTransition, STATE_TYPE, WORKFLOW_EVENT, type WorkflowConfig } from "./index.js";

it("accepts only canonical same-role queue pickups, including custom identifiers", () => {
  const workflow: WorkflowConfig = { initial: "waiting", states: {
    waiting: { type: STATE_TYPE.QUEUE, role: "security", label: "Waiting", color: "#111111",
      on: { PICKUP: { target: "auditing" } } },
    auditing: { type: STATE_TYPE.ACTIVE, role: "security", label: "Audit", color: "#222222" },
  } };

  assert.equal(resolveQueuePickup(workflow, "waiting", "security")?.toState, "auditing");
  assert.equal(resolveQueuePickup(workflow, "Waiting", "security"), null);
  assert.equal(resolveQueuePickup(workflow, "waiting", "developer"), null);
  assert.equal(resolveQueuePickup(workflow, "auditing", "security"), null);
  workflow.states.auditing = { type: STATE_TYPE.ACTIVE, role: "other", label: "Audit", color: "#222222" };
  assert.equal(resolveQueuePickup(workflow, "waiting", "security"), null);
  workflow.states.auditing = { type: STATE_TYPE.TERMINAL, label: "Finished", color: "#222222" };
  assert.equal(resolveQueuePickup(workflow, "waiting", "security"), null);
  delete workflow.states.auditing;
  assert.equal(resolveQueuePickup(workflow, "waiting", "security"), null);
});

it("resolves custom identities and descriptions without deriving keys from labels", () => {
  const workflow: WorkflowConfig = { initial: "audit", states: {
    audit: { type: STATE_TYPE.ACTIVE, role: "security", label: "Audit running", color: "#111111",
      on: { COMPLETE: { target: "accepted", actions: [ACTION.CLOSE_ISSUE] } } },
    accepted: { type: STATE_TYPE.TERMINAL, label: "Accepted", description: "Audit accepted", color: "#222222" },
  } };
  const resolved = resolveCompletionTransition(workflow, "security", WORKFLOW_EVENT.COMPLETE);

  assert.deepEqual(resolved, { fromState: "audit", fromLabel: "Audit running", toState: "accepted", toLabel: "Accepted",
    description: "Audit accepted", actions: [ACTION.CLOSE_ISSUE] });
  resolved?.actions.push(ACTION.CLOSE_ISSUE);
  assert.deepEqual(workflow.states.audit?.on?.COMPLETE?.actions, [ACTION.CLOSE_ISSUE]);
  assert.equal(resolveWorkflowTransition(workflow, "audit", WORKFLOW_EVENT.PASS), null);
  assert.equal(resolveWorkflowTransition(workflow, "missing", WORKFLOW_EVENT.COMPLETE), null);
  assert.equal(resolveCompletionTransition(workflow, "removed", WORKFLOW_EVENT.COMPLETE), null);
  assert.equal(resolveWorkflowTransition(workflow, "accepted", WORKFLOW_EVENT.COMPLETE), null);
});

it("returns no transition for a missing target and falls back to the target label", () => {
  const workflow: WorkflowConfig = { initial: "working", states: {
    working: { type: STATE_TYPE.ACTIVE, role: "custom", label: "Working", color: "#111111",
      on: { COMPLETE: { target: "absent" } } },
  } };

  assert.equal(resolveCompletionTransition(workflow, "custom", WORKFLOW_EVENT.COMPLETE), null);
  workflow.states.absent = { type: STATE_TYPE.TERMINAL, label: "Finished", color: "#222222" };
  assert.equal(resolveCompletionTransition(workflow, "custom", WORKFLOW_EVENT.COMPLETE)?.description, "Finished");
});
