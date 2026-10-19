/** Contracts for provider discussion without workflow or ownership changes. */

import type { RunCommand } from "../../../context.js";
import type { IssueProvider } from "../../../integrations/index.js";

/** Validated comment request with optional injected provider transport. */
export type CommentOnTaskInput = {
  /** Workspace containing project configuration. */
  workspaceDir: string;
  /** Unambiguous registered project channel. */
  channelId: string;
  /** Provider issue receiving the comment; local initialization is not required for discussion. */
  issueId: number;
  /** Nonblank user-supplied markdown. */
  body: string;
  /** Configured attribution role, or orchestrator. */
  authorRole?: string;
  /** Plugin command transport. */
  runCommand: RunCommand;
  /** Explicit provider implementation for embedding and tests. */
  provider?: IssueProvider;
};
