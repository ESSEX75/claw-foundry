/** Defines normalized SDK routing identity without project selection or attachment persistence. */

/** Complete incoming route passed to application-owned project resolution. */
export type AttachmentMessageRoute = {
  /** Explicit SDK channel identifier. */
  channel: string;
  /** Explicit account, without a guessed default. */
  accountId: string;
  /** Conversation identity without a canonical topic qualifier. */
  conversationId: string;
  /** Exact thread agreed by message and conversation evidence. */
  threadId?: string;
  /** Owner parsed from an explicitly scoped canonical SDK session. */
  agentId: string;
};
