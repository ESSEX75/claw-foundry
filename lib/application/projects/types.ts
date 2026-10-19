/** Shared contracts for an unambiguous project and persisted notification route. */

import type { RunCommand } from "../../context.js";
import type { NotificationEndpoint, Project, WorkflowConfig } from "../../domain/index.js";
import type { ProjectsData } from "../../state/index.js";
import type { RouteConfig } from "./routing/index.js";

/** Complete route identity used to match a project endpoint without guessing. */
export type ProjectRoute = {
  /** Messaging transport, such as telegram or slack. */
  channel: string;
  /** Explicit account owning the endpoint. */
  accountId: string;
  /** Conversation identifier without a topic suffix. */
  channelId: string;
  /** Exact topic or thread, absent for an unthreaded conversation. */
  threadId?: string;
};

/** One project and endpoint selected from a strict registry snapshot. */
export type ProjectContext = {
  /** Validated registry used for the selection. */
  data: ProjectsData;
  /** Sole owning project. */
  project: Project;
  /** Sole matched endpoint; callers can persist its binding directly. */
  endpoint: NotificationEndpoint;
};

/** Exact destination selection shared by channel commands. */
export type ProjectChannelInput = {
  /** Workspace containing the registry. */
  workspaceDir: string;
  /** Canonical slug or unambiguous display name. */
  projectRef: string;
  /** Complete endpoint identity, excluding its display name. */
  route: Omit<NotificationEndpoint, "name">;
};

/** Explicit channel linking dependencies and owner context. */
export type LinkProjectChannelInput = ProjectChannelInput & {
  /** SDK-resolved caller, checked again inside the registry transaction. */
  agentId: string;
  /** Fresh SDK route configuration available at commit time. */
  getConfig: () => RouteConfig;
  /** Optional endpoint binding name; generated under lock when omitted. */
  name?: string;
};

/** Committed or previewed channel operation with its exact endpoint. */
export type ProjectChannelResult = {
  /** Registry snapshot after the operation, or the preview snapshot. */
  project: Project;
  /** Endpoint that was selected or linked. */
  endpoint: NotificationEndpoint;
  /** Whether this invocation changed registry state. */
  changed: boolean;
};

/** Registration intent; existing projects must match every immutable repository setting. */
export type RegisterProjectInput = {
  /** Workspace receiving the registration. */
  workspaceDir: string;
  /** Requested display name, normalized once to a canonical slug. */
  name: string;
  /** Repository path retained in the registry. */
  repo: string;
  /** Development branch. */
  baseBranch: string;
  /** Deployment branch, defaulting to the base branch. */
  deployBranch?: string;
  /** Explicit owner supplied by SDK context. */
  agentId: string;
  /** Initial or additional exact destination. */
  route: Omit<NotificationEndpoint, "name">;
  /** Current SDK configuration, rechecked before registry commit. */
  getConfig: () => RouteConfig;
  /** Provider command transport. */
  runCommand: RunCommand;
};

/** Durable registration result; scaffold failure never hides an already committed project. */
export type RegisterProjectResult = ProjectChannelResult & {
  /** Resolved workflow used for provider provisioning and adapter guidance. */
  workflow: WorkflowConfig;
  /** Whether a new project was committed by this invocation. */
  isNewProject: boolean;
  /** Number of label definitions ensured before the commit. */
  labelsEnsured: number;
  /** Whether project documentation was exclusively created by this invocation. */
  promptsScaffolded: boolean;
  /** Recoverable post-commit scaffold failure; retry the same registration to finish. */
  scaffoldError?: string;
};
