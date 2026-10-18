/** Exercises configured lifecycle order through completion persistence and exact-run replay. */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";

import { ACTION, type TransitionAction } from "../../domain/index.js";
import { DATA_DIR, readIssueStateStore, updateIssueRuntimeRecord } from "../../state/index.js";
import { completeWorkerForTesting, createTestHarness } from "../../testing/index.js";
import { retryPendingPipelineNotifications, type NotificationRuntime } from "../notifications/index.js";

/** Workflow override fixture accepted as YAML's JSON subset. */
const WORKFLOW_FIXTURE_FILE = "workflow.yaml";

for (const delivery of ["completion", "retry"]) {
  for (const actions of [[ACTION.CLOSE_ISSUE, ACTION.REOPEN_ISSUE], [ACTION.REOPEN_ISSUE, ACTION.CLOSE_ISSUE]] satisfies TransitionAction[][]) {
    it(`${delivery} delivery reports the committed lifecycle of ${actions.join(" then ")}`, async t => {
      const h = await createTestHarness();

      t.after(() => h.cleanup());
      await fs.writeFile(path.join(h.workspaceDir, DATA_DIR, WORKFLOW_FIXTURE_FILE),
        JSON.stringify({ workflow: { states: { testing: { on: { PASS: { target: "done", actions } } } } } }));
      await h.seedManagedIssue({ iid: 42, labels: ["Testing"], state: "closed" });
      await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, state => {
        assert.ok(state);

        return { ...state, closedAt: "2026-01-01T00:00:00.000Z" };
      });
      const input = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug, projectName: h.project.name,
        channels: h.project.channels, issueId: 42, role: "tester", result: "pass", provider: h.provider,
        repoPath: h.project.repo, runCommand: h.runCommand };
      const completed = await completeWorkerForTesting(input);
      const state = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"];
      const closed = actions.at(-1) === ACTION.CLOSE_ISSUE;

      assert.equal(completed.issueClosed, closed);
      assert.equal(completed.issueReopened, !closed);
      assert.equal(state.closedAt !== null, closed);
      assert.equal((await h.provider.getIssue(42)).state, closed ? "closed" : "opened");
      const mutations = h.provider.callsTo("closeIssue").length + h.provider.callsTo("reopenIssue").length;

      assert.equal((await completeWorkerForTesting(input)).issueClosed, closed);
      assert.equal(h.provider.callsTo("closeIssue").length + h.provider.callsTo("reopenIssue").length, mutations);
      const endpoint = h.project.channels[0];

      assert.ok(endpoint);
      const runtime: NotificationRuntime = {
        config: { current: () => ({ agents: { list: [{ id: h.project.agentId }] },
          channels: { [endpoint.channel]: { enabled: true, accounts: { [endpoint.accountId]: {} } } },
          bindings: [{ agentId: h.project.agentId, match: { channel: endpoint.channel, accountId: endpoint.accountId,
            peer: { kind: "group", id: endpoint.channelId } } }] }) },
        channel: { outbound: { loadAdapter: async () => ({}) } },
      };

      // Advance only the fixture's proven non-send backoff, preserving the committed lifecycle.
      await updateIssueRuntimeRecord(h.workspaceDir, h.project.slug, 42, current => {
        assert.ok(current?.pipelineNotification);

        return { ...current, pipelineNotification: { ...current.pipelineNotification, attemptedAt: "2026-01-01T00:00:00.000Z" } };
      });
      if (delivery === "retry") {
        assert.equal(await retryPendingPipelineNotifications(h.workspaceDir, h.project, h.provider, undefined, runtime, h.runCommand, 10), 1);
      } else {
        await completeWorkerForTesting({ ...input, runtime });
      }
      const messages = h.commands.commands.filter(command => command.argv[0] === "openclaw" && command.argv[1] === "message")
        .map(command => command.argv[command.argv.indexOf("--message") + 1]);
      const terminal = messages.find(message => message?.includes("Pipeline completed #42"));

      assert.ok(terminal);
      assert.equal(terminal.includes("Issue closed"), closed);
    });
  }
}

it("completion and replay report only lifecycle actions processed before a merge conflict", async t => {
  const h = await createTestHarness();

  t.after(() => h.cleanup());
  await fs.writeFile(path.join(h.workspaceDir, DATA_DIR, WORKFLOW_FIXTURE_FILE), JSON.stringify({ workflow: { states: {
    reviewing: { on: { APPROVE: { target: "toTest", actions: [ACTION.CLOSE_ISSUE, ACTION.MERGE_PR, ACTION.REOPEN_ISSUE] } } },
  } } }));
  await h.seedManagedIssue({ iid: 42, labels: ["Reviewing"] });
  h.provider.setPrStatus(42, { state: "open", url: "https://example.test/pr/42" });
  h.provider.mergePrFailures.add(42);
  const input = { workspaceDir: h.workspaceDir, projectSlug: h.project.slug, projectName: h.project.name,
    channels: h.project.channels, issueId: 42, role: "reviewer", result: "approve", provider: h.provider,
    repoPath: h.project.repo, runCommand: h.runCommand };
  const completed = await completeWorkerForTesting(input);

  assert.equal(completed.nextState, "To Improve");
  assert.equal(completed.issueClosed, true);
  assert.equal(completed.issueReopened, false);
  const state = (await readIssueStateStore(h.workspaceDir, h.project.slug)).issues["42"];

  assert.ok(state.closedAt);
  assert.deepEqual(state.lastCompletion?.actions, [ACTION.CLOSE_ISSUE]);
  const replayed = await completeWorkerForTesting(input);

  assert.equal(replayed.issueClosed, true);
  assert.equal(replayed.issueReopened, false);
  assert.equal(h.provider.callsTo("mergePr").length, 1);
  assert.equal(h.provider.callsTo("reopenIssue").length, 0);
});
