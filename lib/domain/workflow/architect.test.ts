/** Verifies the architect research graph and completion rules in built-in workflow semantics. */

import assert from "node:assert";
import { describe, it } from "node:test";
import { getCompletionRule } from "./completion.js";
import { WORKFLOW_EVENT } from "./const.js";
import { DEFAULT_WORKFLOW } from "./defaults.js";
import { getActiveLabel, getQueueLabels, getStateLabels, hasWorkflowStates } from "./queries.js";

describe("architect workflow — To Research / Researching states", () => {
  it("should have To Research in state labels", () => {
    const labels = getStateLabels(DEFAULT_WORKFLOW);

    assert.ok(labels.includes("To Research"), "To Research should exist");
  });

  it("should have Researching in state labels", () => {
    const labels = getStateLabels(DEFAULT_WORKFLOW);

    assert.ok(labels.includes("Researching"), "Researching should exist");
  });

  it("should have 'To Research' as architect queue label", () => {
    const queues = getQueueLabels(DEFAULT_WORKFLOW, "architect");

    assert.ok(queues.includes("To Research"), "architect queue should include To Research");
  });

  it("should report architect HAS workflow states", () => {
    assert.strictEqual(hasWorkflowStates(DEFAULT_WORKFLOW, "architect"), true);
  });

  it("should report developer has workflow states", () => {
    assert.strictEqual(hasWorkflowStates(DEFAULT_WORKFLOW, "developer"), true);
  });

  it("should report tester has workflow states", () => {
    assert.strictEqual(hasWorkflowStates(DEFAULT_WORKFLOW, "tester"), true);
  });

  it("should have 'Researching' as architect active state", () => {
    const active = getActiveLabel(DEFAULT_WORKFLOW, "architect");

    assert.strictEqual(active, "Researching");
  });

  it("should have completion rule for architect:done → Done", () => {
    const rule = getCompletionRule(DEFAULT_WORKFLOW, "architect", WORKFLOW_EVENT.COMPLETE);

    assert.ok(rule !== null, "architect:done rule should exist");
    assert.strictEqual(rule.from, "Researching");
    assert.strictEqual(rule.to, "Done");
    assert.deepStrictEqual(rule.actions, ["closeIssue"], "closes research issue on completion");
  });

  it("should have completion rule for architect:blocked → Refining", () => {
    const rule = getCompletionRule(DEFAULT_WORKFLOW, "architect", WORKFLOW_EVENT.BLOCKED);

    assert.ok(rule !== null, "architect:blocked rule should exist");
    assert.strictEqual(rule.from, "Researching");
    assert.strictEqual(rule.to, "Refining");
  });


  it("should NOT have To Design or Designing in state labels", () => {
    const labels = new Set<string>(getStateLabels(DEFAULT_WORKFLOW));

    assert.ok(!labels.has("To Design"), "To Design should not exist");
    assert.ok(!labels.has("Designing"), "Designing should not exist");
  });
});
