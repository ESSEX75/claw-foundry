/** Contracts for attachment commands, exact message routing, and display enrichment. */

import type { RunCommand } from "../../../context.js";
import type { Project } from "../../../domain/index.js";
import type { IssueProvider, MediaAttachmentInfo } from "../../../integrations/index.js";
import type { ValueOf } from "../../../types.js";
import type { ATTACHMENT_ACTION } from "./const.js";

/** Shared command for automatic and manual attachment uploads. */
export type ProcessAttachmentInput = {
  /** Workspace storing local attachments. */
  workspaceDir: string;
  /** Canonical project identifier. */
  projectSlug: string;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Provider upload and issue capabilities. */
  provider: IssueProvider;
  /** Actor supplying the attachments. */
  uploader: string;
  /** Ordered media staged by the caller. */
  mediaAttachments: MediaAttachmentInfo[];
};

/** Adapter-independent manual attachment operation. */
export type TaskAttachmentInput = {
  /** Workspace containing the project registry. */
  workspaceDir: string;
  /** Unambiguous persisted project destination. */
  channelId: string;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Requested operation. */
  action: ValueOf<typeof ATTACHMENT_ACTION>;
  /** Authorized local source for add. */
  filePath?: string;
  /** Persisted attachment identity for get. */
  attachmentId?: string;
  /** Runtime-owned provider transport. */
  runCommand: RunCommand;
};

/** One configured owner's effective workspace. */
export type AttachmentWorkspace = {
  /** Configured agent identity. */
  agentId: string;
  /** SDK-resolved workspace root. */
  workspaceDir: string;
};

/** Unambiguous project selected for incoming media. */
export type AttachmentProjectContext = {
  /** Registry workspace owning the project. */
  workspaceDir: string;
  /** Validated registered project. */
  project: Project;
};
