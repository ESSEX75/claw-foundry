/** Owns contracts for content. */

import type { RunCommand } from "../../../context.js";

/** Requested user-content edit, executed after fresh eligibility checks under the issue lock. */
export type EditTaskBodyInput = {
  /** Configured workspace containing authoritative project state. */
  workspaceDir: string;
  /** Persisted notification destination used to resolve exactly one project. */
  channelId: string;
  /** Provider-local issue identifier. */
  issueId: number;
  /** Requested title, omitted to retain current provider content. */
  title?: string;
  /** Requested user description, excluding authoritative metadata. */
  body?: string;
  /** Operator explanation or reason the command could not proceed. */
  reason?: string;
  /** Whether to publish an explanatory provider comment; defaults to true. */
  addComment?: boolean;
  /** Runtime-owned command transport for provider operations. */
  runCommand: RunCommand;
};
