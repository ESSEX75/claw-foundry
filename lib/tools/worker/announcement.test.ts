/** Locks operator completion text to committed outcomes, independently of worker prompts and notifications. */

import assert from "node:assert/strict";
import { it } from "node:test";

import type { FinishWorkResult } from "../../application/index.js";
import { renderCompletionAnnouncement } from "./announcement.js";

/** A committed result with all optional operator navigation facts. */
const completed: FinishWorkResult = {
  success: true, project: "Demo", projectSlug: "demo", issueId: 42, role: "developer", result: "done",
  labelTransition: "Doing → To Review", nextState: "Waiting for review", summary: "Implemented login",
  issueUrl: "https://example.test/issues/42", prUrl: "https://example.test/pull/9",
  createdTasks: [{ id: 43, title: "Follow-up", url: "https://example.test/issues/43" }],
};

it("preserves the completion summary, navigation and created-task order", () => {
  assert.equal(renderCompletionAnnouncement(completed),
    "✅ DEVELOPER DONE #42 — Implemented login\n📋 [Issue #42](https://example.test/issues/42)"
      + "\n🔗 [PR](https://example.test/pull/9)\n📌 Created tasks:"
      + "\n  - [#43: Follow-up](https://example.test/issues/43)\nWaiting for review.");
});

it("renders a confirmed merge failure without presenting the worker summary as success", () => {
  assert.equal(renderCompletionAnnouncement({ ...completed, mergeFailure: "Merge conflict", nextState: "To Improve" }),
    "⚠️ MERGE FAILED #42 — Merge conflict\n📋 [Issue #42](https://example.test/issues/42)\n→ To Improve.");
});
