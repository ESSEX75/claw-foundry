/** Exercises exact route removal and locked last-endpoint protection through the SDK adapter. */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NOTIFICATION_CHANNEL } from "../../domain/index.js";
import { createTestHarness } from "../../testing/index.js";
import { createChannelUnlinkTool } from "./channel-unlink.js";

describe("channel_unlink exact route", () => {
  it("previews and removes only the selected account, transport and topic", async () => {
    const h = await createTestHarness();
    try {
      const channels = [
        { channel: NOTIFICATION_CHANNEL.TELEGRAM, accountId: "first", channelId: "shared", name: "first" },
        { channel: NOTIFICATION_CHANNEL.TELEGRAM, accountId: "second", channelId: "shared", name: "second" },
        { channel: NOTIFICATION_CHANNEL.WHATSAPP, accountId: "second", channelId: "shared", name: "other-transport" },
        { channel: NOTIFICATION_CHANNEL.TELEGRAM, accountId: "second", channelId: "shared", threadId: "topic", name: "topic" },
      ];
      await h.writeProjects({ projects: { [h.project.slug]: { ...h.project, channels } } });
      const tool = createChannelUnlinkTool()({ config: {}, workspaceDir: h.workspaceDir });
      assert.ok(tool && !Array.isArray(tool));
      const input = { project: h.project.slug, channel: NOTIFICATION_CHANNEL.TELEGRAM,
        accountId: "second", channelId: "shared" };
      const preview = await tool.execute("preview", input);
      assert.ok(preview.details && typeof preview.details === "object" && "channelName" in preview.details);
      assert.equal(preview.details.channelName, "second");
      assert.deepEqual((await h.readProjects()).projects[h.project.slug]?.channels, channels);
      await assert.rejects(tool.execute("ambiguous", { project: h.project.slug, channelId: "shared", confirm: true }), /channel/);
      await tool.execute("remove", { ...input, confirm: true });
      assert.deepEqual((await h.readProjects()).projects[h.project.slug]?.channels, channels.filter(ch => ch.name !== "second"));
      await tool.execute("remove-topic", { ...input, threadId: "topic", confirm: true });
      assert.deepEqual((await h.readProjects()).projects[h.project.slug]?.channels, channels.filter(ch => ch.accountId === "first" || ch.channel === NOTIFICATION_CHANNEL.WHATSAPP));
      await assert.rejects(tool.execute("repeat", { ...input, confirm: true }), /not found/);
    } finally { await h.cleanup(); }
  });

  it("rechecks the last endpoint under lock during concurrent removals", async () => {
    const h = await createTestHarness();
    try {
      const primary = h.project.channels[0];
      assert.ok(primary);
      await h.writeProjects({ projects: { [h.project.slug]: { ...h.project,
        channels: [primary, { ...primary, accountId: "other", name: "other" }] } } });
      const tool = createChannelUnlinkTool()({ config: {}, workspaceDir: h.workspaceDir });
      assert.ok(tool && !Array.isArray(tool));
      const outcomes = await Promise.allSettled(["default", "other"].map(accountId => tool.execute(accountId, {
        project: h.project.slug, channel: primary.channel, channelId: primary.channelId, accountId, confirm: true,
      })));
      assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 1);
      const failure = outcomes.find(outcome => outcome.status === "rejected");
      assert.ok(failure && failure.status === "rejected");
      assert.match(String(failure.reason), /last.*channel/i);
      assert.equal((await h.readProjects()).projects[h.project.slug]?.channels.length, 1);
    } finally { await h.cleanup(); }
  });
});
