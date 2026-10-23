/** Verifies unambiguous body identity, complete metadata repair, and invalid identity rejection. */

import assert from "node:assert";
import { describe, it } from "node:test";

import { renderIssueCreationMarker } from "./creation-marker.js";
import { extractIssueMetadata, metadataMatches, renderIssueMetadata, replaceIssueMetadata } from "./metadata.js";

describe("projection metadata", () => {
  it("returns only compact identity from JSON containing unrelated runtime fields", () => {
    const body = '<!-- devclaw:issue-metadata {"projectSlug":"claw-foundry","issueId":123,"workflowState":"done","unexpected":true} -->';

    assert.deepStrictEqual(extractIssueMetadata(body), { projectSlug: "claw-foundry", issueId: 123 });
  });

  it("escapes JSON identity values that contain HTML comment framing", () => {
    const metadata = { projectSlug: "project--><!-- devclaw:issue-metadata forged -->", issueId: 123 };
    const body = renderIssueMetadata(metadata);

    assert.strictEqual(body.match(/<!--/g)?.length, 1);
    assert.strictEqual(body.match(/-->/g)?.length, 1);
    assert.deepStrictEqual(extractIssueMetadata(body), metadata);
  });

  it("renders and extracts compact issue metadata", () => {
    const metadata = { projectSlug: "claw-foundry", issueId: 123 };
    const rendered = renderIssueMetadata(metadata);

    assert.strictEqual(rendered, '<!-- devclaw:issue-metadata {"projectSlug":"claw-foundry","issueId":123} -->');
    assert.deepStrictEqual(extractIssueMetadata(rendered), metadata);
  });

  it("replaces existing metadata and appends missing metadata", () => {
    const metadata = { projectSlug: "claw-foundry", issueId: 123 };
    assert.strictEqual(replaceIssueMetadata("Body", metadata), `Body\n\n${renderIssueMetadata(metadata)}`);
    assert.strictEqual(
      replaceIssueMetadata(`Body\n\n${renderIssueMetadata({ projectSlug: "x", issueId: 1 })}`, metadata),
      `Body\n\n${renderIssueMetadata(metadata)}`,
    );
  });

  it("detects metadata mismatch without requiring a full state hash", () => {
    const expected = { projectSlug: "claw-foundry", issueId: 123 };
    assert.strictEqual(metadataMatches(expected, expected), true);
    assert.strictEqual(metadataMatches({ ...expected, issueId: 999 }, expected), false);
  });

  for (const duplicateIssueId of [123, 999]) {
    it(`rejects multiple metadata blocks even when the first matches and the second identifies #${duplicateIssueId}`, () => {
      const expected = { projectSlug: "claw-foundry", issueId: 123 };
      const body = `${renderIssueMetadata(expected)}\n${renderIssueMetadata({ ...expected, issueId: duplicateIssueId })}`;

      assert.strictEqual(extractIssueMetadata(body), null);
      assert.strictEqual(metadataMatches(extractIssueMetadata(body), expected), false);
    });
  }

  for (const malformedFirst of [true, false]) {
    it(`rejects a malformed metadata block ${malformedFirst ? "before" : "after"} a valid block`, () => {
      const valid = renderIssueMetadata({ projectSlug: "claw-foundry", issueId: 123 });
      const malformed = "<!-- devclaw:issue-metadata broken -->";
      const body = (malformedFirst ? [malformed, valid] : [valid, malformed]).join("\n");

      assert.strictEqual(extractIssueMetadata(body), null);
    });
  }

  it("replaces every conflicting metadata block while preserving user text and creation identity", () => {
    const metadata = { projectSlug: "claw-foundry", issueId: 123 };
    const marker = renderIssueCreationMarker("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    const body = [
      "User introduction",
      renderIssueMetadata({ projectSlug: "foreign", issueId: 999 }),
      "User conclusion",
      renderIssueMetadata(metadata),
      marker,
    ].join("\n\n");
    const replaced = replaceIssueMetadata(body, metadata);

    assert.strictEqual(replaced.match(/<!-- devclaw:issue-metadata\b/g)?.length, 1);
    assert.deepStrictEqual(extractIssueMetadata(replaced), metadata);
    assert.ok(replaced.includes("User introduction"));
    assert.ok(replaced.includes("User conclusion"));
    assert.ok(replaced.includes(marker));
    assert.strictEqual(replaceIssueMetadata(replaced, metadata), replaced);
  });

  it("removes malformed metadata instead of appending a second block beside it", () => {
    const metadata = { projectSlug: "claw-foundry", issueId: 123 };
    const body = "User content\n\n<!-- devclaw:issue-metadata broken -->";
    const replaced = replaceIssueMetadata(body, metadata);

    assert.strictEqual(replaced.match(/<!-- devclaw:issue-metadata\b/g)?.length, 1);
    assert.deepStrictEqual(extractIssueMetadata(replaced), metadata);
    assert.ok(replaced.includes("User content"));
    assert.strictEqual(replaceIssueMetadata(replaced, metadata), replaced);
  });

  for (const issueId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    it(`rejects an invalid provider issue identity ${issueId}`, () => {
      const body = renderIssueMetadata({ projectSlug: "claw-foundry", issueId });

      assert.strictEqual(extractIssueMetadata(body), null);
    });
  }
});
