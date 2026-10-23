/** Verifies label ownership and preservation of authoritative local fields across configuration drift. */

import assert from "node:assert";
import { describe, it } from "node:test";

import { ISSUE_INTEGRITY_STATUS, ISSUE_PROVIDER, NOTIFICATION_CHANNEL, REVIEW_POLICY, TEST_POLICY, type IssueRuntimeState } from "../../domain/index.js";
import { isManagedLabel } from "./classification.js";
import { diffIssueProjection } from "./diff.js";
import { expectedManagedLabels } from "./render.js";

/** Build authoritative local state independently of observed provider labels.
 * @param overrides - Local fields varied by the projection scenario.
 */
function state(overrides: Partial<IssueRuntimeState> = {}): IssueRuntimeState {
  return {
    projectSlug: "claw-foundry",
    issueId: 123,
    provider: ISSUE_PROVIDER.GITHUB,
    workflowState: "todo",
    workflowLabel: "To Do",
    assignedRole: "developer",
    assignedLevel: "medior",
    owner: "main",
    reviewPolicy: "human",
    testPolicy: "skip",
    notifyTarget: { channel: NOTIFICATION_CHANNEL.TELEGRAM, name: "primary" },
    activeWorker: null,
    integrityStatus: ISSUE_INTEGRITY_STATUS.OK,
    integrityErrors: [],
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
    closedAt: null,
    providerMissing: null,
    pipelineNotification: null,
    ...overrides,
  };
}

describe("projection labels", () => {
  it("renders every saved policy pair and diagnoses provider edits without mutating local truth", () => {
    for (const reviewPolicy of Object.values(REVIEW_POLICY)) {
      for (const testPolicy of Object.values(TEST_POLICY)) {
        const local = state({ reviewPolicy, testPolicy });
        const snapshot = structuredClone(local);
        const labels = expectedManagedLabels(local);

        assert.ok(labels.includes(`review:${reviewPolicy}`));
        assert.ok(labels.includes(`test:${testPolicy}`));
        assert.ok(labels.includes("owner:main"));
        const options = { stateLabels: ["To Do", "Doing"], roles: ["developer"] };
        const synchronized = diffIssueProjection({ state: local, actualLabels: labels, options });

        assert.deepEqual(synchronized.missingManagedLabels, []);
        assert.deepEqual(synchronized.unexpectedManagedLabels, []);
        const drift = diffIssueProjection({ state: local, actualLabels: ["Doing", "review:manual"], options });

        assert.ok(drift.missingManagedLabels.includes("To Do"));
        assert.deepEqual(local, snapshot);
      }
    }
  });
  it("preserves plugin-prefixed labels that have no configured or local meaning", () => {
    const local = state();
    const expected = expectedManagedLabels(local);
    const userLabels = ["claw-foundry:example", "devclaw:issue-creation", "devclaw:issue-metadata"];
    const options = { stateLabels: ["To Do", "Doing"], roles: ["developer"] };
    const diff = diffIssueProjection({ state: local, actualLabels: [...expected, ...userLabels], options });

    for (const label of userLabels) assert.strictEqual(isManagedLabel(label, options), false);
    assert.deepStrictEqual(diff.actualManagedLabels, expected);
    assert.deepStrictEqual(diff.unmanagedLabels, userLabels);
    assert.deepStrictEqual(diff.missingManagedLabels, []);
    assert.deepStrictEqual(diff.unexpectedManagedLabels, []);
  });

  it("classifies plugin-prefixed labels only through explicit workflow or role ownership", () => {
    assert.strictEqual(isManagedLabel("claw-foundry:queued", { stateLabels: ["claw-foundry:queued"], roles: [] }), true);
    assert.strictEqual(isManagedLabel("claw-foundry:junior", { stateLabels: [], roles: ["claw-foundry"] }), true);
    assert.strictEqual(isManagedLabel("claw-foundry:junior", { stateLabels: [], roles: [] }), false);
  });

  it("derives expected managed labels from issue state", () => {
    assert.deepStrictEqual(expectedManagedLabels(state()), [
      "To Do",
      "developer:medior",
      "notify:telegram:primary",
      "owner:main",
      "review:human",
      "test:skip",
    ]);
  });

  it("diffs missing and unexpected managed labels while preserving human labels", () => {
    const diff = diffIssueProjection({
      state: state(),
      actualLabels: ["Doing", "bug", "developer:senior", "owner:main", "priority:high"],
      options: { stateLabels: ["To Do", "Doing"], roles: ["developer"] },
    });

    assert.deepStrictEqual(diff.unmanagedLabels, ["bug", "priority:high"]);
    assert.ok(diff.missingManagedLabels.includes("To Do"));
    assert.ok(diff.missingManagedLabels.includes("developer:medior"));
    assert.ok(diff.unexpectedManagedLabels.includes("Doing"));
    assert.ok(diff.unexpectedManagedLabels.includes("developer:senior"));
  });

  it("recognizes a present local workflow label after configuration renames it", () => {
    const local = state();
    const expected = expectedManagedLabels(local);
    const diff = diffIssueProjection({
      state: local,
      actualLabels: [...expected, "priority:high"],
      options: { stateLabels: ["Backlog", "Doing"], roles: ["developer"] },
    });

    assert.deepStrictEqual(diff.missingManagedLabels, []);
    assert.deepStrictEqual(diff.unexpectedManagedLabels, []);
    assert.deepStrictEqual(diff.actualManagedLabels, expected);
    assert.deepStrictEqual(diff.unmanagedLabels, ["priority:high"]);
    assert.strictEqual(local.workflowLabel, "To Do");
  });

  it("recognizes the exact local role label after its role is removed from configuration", () => {
    const local = state({ assignedRole: "security", assignedLevel: "expert" });
    const expected = expectedManagedLabels(local);
    const diff = diffIssueProjection({
      state: local,
      actualLabels: [...expected, "security:other", "priority:high"],
      options: { stateLabels: ["To Do"], roles: ["developer"] },
    });

    assert.deepStrictEqual(diff.missingManagedLabels, []);
    assert.deepStrictEqual(diff.unexpectedManagedLabels, []);
    assert.deepStrictEqual(diff.actualManagedLabels, expected);
    assert.deepStrictEqual(diff.unmanagedLabels, ["priority:high", "security:other"]);
    assert.strictEqual(local.assignedRole, "security");
  });

  it("rejects missing role configuration before scheduling any label removals", () => {
    const options = { stateLabels: ["To Do"], roles: [] };

    // Simulate a JavaScript caller that omits a required TypeScript field.
    Reflect.deleteProperty(options, "roles");
    assert.throws(() => diffIssueProjection({
      state: state({ assignedRole: null, assignedLevel: null }),
      actualLabels: ["To Do", "priority:high", "team:backend"],
      options,
    }), /explicit configured role list/);
  });

  it("preserves unrelated colon labels with an explicitly empty role registry", () => {
    const diff = diffIssueProjection({
      state: state({ assignedRole: null, assignedLevel: null }),
      actualLabels: ["To Do", "priority:high", "team:backend"],
      options: { stateLabels: ["To Do"], roles: [] },
    });

    assert.deepStrictEqual(diff.unexpectedManagedLabels, []);
    assert.deepStrictEqual(diff.unmanagedLabels, ["priority:high", "team:backend"]);
  });
});
