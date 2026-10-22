/** Normalizes SDK attachment routing without discovering workspaces or selecting a managed project. */

import type { AttachmentMessageRoute } from "../routing/index.js";
import { TOPIC_PEER_SEPARATOR } from "../routing/index.js";
import { ATTACHMENT_AGENT_SESSION } from "./const.js";
import type { AttachmentMessageContext, AttachmentMessageEvent } from "./types.js";

/** Retain an exact scoped owner/account/conversation route; incomplete or contradictory identities are rejected.
 * @param event - SDK-normalized message, including optional explicit thread/session identities.
 * @param context - SDK context supplying channel, account and conversation scope.
 */
export function normalizeAttachmentRoute(event: AttachmentMessageEvent, context: AttachmentMessageContext): AttachmentMessageRoute | null {
  const sessionKey = context.sessionKey ?? event.sessionKey;
  const agentId = sessionKey ? ATTACHMENT_AGENT_SESSION.exec(sessionKey)?.[1] : undefined;

  if (!context.accountId || !context.conversationId || !agentId) return null;
  const [conversationId, topic, ...extra] = context.conversationId.split(TOPIC_PEER_SEPARATOR);

  if (!conversationId || extra.length || (topic !== undefined && !topic)) return null;
  const threadId = event.threadId === undefined ? topic : String(event.threadId);

  //TODO: Remove topics
  if (topic !== undefined && threadId !== topic) return null;

  return { channel: context.channelId, accountId: context.accountId, conversationId, threadId, agentId };
}
