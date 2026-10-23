/** Owns workspace harness configuration and lifecycle contracts. */

import type { RunCommand } from "../../context.js";
import type { Project, SlotState, WorkflowConfig } from "../../domain/index.js";
import type { Issue } from "../../integrations/index.js";
import type { ProjectsData } from "../../state/index.js";
import type { CommandInterceptor } from "../commands/index.js";
import type { IssueSeed, TestProvider } from "../providers/index.js";

/** Mutable bootstrap outcome observed after the real hook completes. */
export type BootstrapResult = {
  /** Whether AGENTS.md was stripped from bootstrap files. */
  agentsMdStripped: boolean;
  /** Instruction content after bootstrap replacement. */
  agentsMdContent: string;
};

/** Isolated project fixture with real local state and deterministic external effects. */
export type TestHarness = {
  /** Temporary workspace directory. */
  workspaceDir: string;
  /** In-memory issue provider. */
  provider: TestProvider;
  /** Command interceptor — captures all runCommand calls. */
  commands: CommandInterceptor;
  /** Explicitly seed provider content and managed runtime; existing runtime remains authoritative. */
  seedManagedIssue(input: IssueSeed): Promise<Issue>;
  /** Mock runCommand function for passing to functions that require it. */
  runCommand: RunCommand;
  /** The project channel ID used for test data. */
  channelId: string;
  /** The project data. */
  project: Project;
  /** Workflow config. */
  workflow: WorkflowConfig;
  /** Write updated projects data to disk. */
  writeProjects(data: ProjectsData): Promise<void>;
  /** Read current projects data from disk. */
  readProjects(): Promise<ProjectsData>;
  /**
   * Write a role prompt file to the workspace.
   * @param role - Role name (e.g. "developer", "tester")
   * @param content - Prompt file content
   * @param projectName - If provided, writes project-specific prompt; otherwise writes default.
   */
  writePrompt(role: string, content: string, projectName?: string): Promise<void>;
  /**
   * Simulate the agent:bootstrap hook firing for a session key.
   * Tests that AGENTS.md is stripped from bootstrap files for Claw Foundry workers.
   */
  simulateBootstrap(sessionKey: string): Promise<BootstrapResult>;
  /** Clean up temp directory. */
  cleanup(): Promise<void>;
};

/** Explicit workspace seeding choices; no managed issue is inferred from provider-only data. */
export type HarnessOptions = {
  /** Project name (default: "test-project"). */
  projectName?: string;
  /** Channel ID (default: "-1234567890"). */
  channelId?: string;
  /** Repo path (default: "/tmp/test-repo"). */
  repo?: string;
  /** Base branch (default: "main"). */
  baseBranch?: string;
  /** Workflow config (default: DEFAULT_WORKFLOW). */
  workflow?: WorkflowConfig;
  /** Initial worker state overrides (level + slot fields). */
  workers?: Record<string, WorkerFixtureOverride>;
  /** Additional projects to seed. */
  extraProjects?: Record<string, Project>;
};


/** One fixture slot override, applied to the requested role and level. */
type WorkerFixtureOverride = Partial<Pick<SlotState, "active" | "issueId" | "sessionKey" | "startTime" | "previousLabel" | "lastIssueId">> & {
  /** Configured level; defaults to senior. */
  level?: string;
};
