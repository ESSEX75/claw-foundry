/** Checks replacement of copied or forged managed body blocks while retaining trusted creation identity. */
import assert from "node:assert/strict";
import { it } from "node:test";
import { composeIssueCreationBody, composeManagedIssueBody, stripManagedIssueBody } from "./compose.js";
import { extractIssueCreationMarker, renderIssueCreationMarker } from "./creation-marker.js";
import { extractIssueMetadata, replaceIssueMetadata } from "./metadata.js";

it("replaces all submitted managed blocks and remains idempotent for empty user content", () => {
  const metadata = { projectSlug: "trusted-project", issueId: 42 };
  const operation = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const supplied = replaceIssueMetadata("User content", { ...metadata, projectSlug: "foreign-project" })
    + "\n<!-- devclaw:issue-metadata broken -->\n" + renderIssueCreationMarker("ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee");
  const composed = composeManagedIssueBody(supplied, metadata, operation);
  assert.deepEqual(extractIssueMetadata(composed), metadata);
  assert.equal(extractIssueCreationMarker(composed), operation);
  assert.equal(composed.match(/devclaw:issue-metadata/g)?.length, 1);
  assert.equal(composed.match(/devclaw:issue-creation/g)?.length, 1);
  assert.ok(composed.startsWith("User content"));
  const empty = composeManagedIssueBody("", metadata, operation);
  assert.equal(composeManagedIssueBody(empty, metadata, operation), empty);
});

for (const body of [
  "User text\n<!-- devclaw:issue-metadata {",
  "User text\n<!-- devclaw:issue-creation missing-close",
  "<!-- devclaw:issue-metadata broken <!-- devclaw:issue-creation abc --> -->",
]) {
  it(`rejects unsafe framing without rebuilding or consuming user text: ${body}`, () => {
    const metadata = { projectSlug: "claw-foundry", issueId: 123 };

    assert.equal(extractIssueMetadata(body), null);
    assert.equal(extractIssueCreationMarker(body), null);
    assert.throws(() => stripManagedIssueBody(body), /nested or unterminated/);
    assert.throws(() => composeManagedIssueBody(body, metadata), /nested or unterminated/);
    assert.throws(() => replaceIssueMetadata(body, metadata), /nested or unterminated/);
  });
}

it("composes pre-create identity without copied metadata or markers and is idempotent", () => {
  const operationId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const copied = replaceIssueMetadata("User content", { projectSlug: "foreign", issueId: 99 })
    + "\n" + renderIssueCreationMarker("ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee");
  const body = composeIssueCreationBody(copied, operationId);

  assert.equal(extractIssueMetadata(body), null);
  assert.equal(extractIssueCreationMarker(body), operationId);
  assert.equal(stripManagedIssueBody(body), "User content");
  assert.equal(composeIssueCreationBody(body, operationId), body);
});

it("removes provider creation identity when the application supplies no local creation identity", () => {
  const body = "User content\n" + renderIssueCreationMarker("ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee");
  const composed = composeManagedIssueBody(body, { projectSlug: "claw-foundry", issueId: 123 });

  assert.equal(extractIssueCreationMarker(composed), null);
  assert.ok(composed.startsWith("User content"));
});

it("does not accept one creation marker as authoritative when multiple markers are present", () => {
  const first = renderIssueCreationMarker("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  const other = renderIssueCreationMarker("ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee");

  assert.equal(extractIssueCreationMarker(`${first}\n${other}`), null);
  assert.equal(extractIssueCreationMarker(`${first}\n${first}`), null);
});
