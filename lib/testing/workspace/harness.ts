/**
 * Test harness — scaffolds a temporary workspace with projects.json,
 * installs a mock runCommand, and provides helpers for E2E pipeline tests.
 *
 * Usage:
 *   const h = await createTestHarness({ ... });
 *   try { ... } finally { await h.cleanup(); }
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { initializeIssueRuntimeState } from "../../application/index.js";
import {
  DEFAULT_WORKFLOW,
  ISSUE_PROVIDER,
  NOTIFICATION_CHANNEL,
  type Project,
  type RoleWorkerState,
  STATE_TYPE,
} from "../../domain/index.js";
import { getAllRoleIds } from "../../roles/index.js";
import { DATA_DIR, loadConfig, type ProjectsData, readIssueStateStore, readProjects } from "../../state/index.js";
import { PROJECTS_DIRECTORY_NAME } from "../../state/index.js";
import { createCommandInterceptor } from "../commands/index.js";
import { TestProvider } from "../providers/index.js";
import { bindWorkerForTesting } from "../state/index.js";
import { simulateBootstrap } from "./bootstrap.js";
import {
  CLEANUP_MAX_RETRIES,
  CLEANUP_RETRY_DELAY_MS,
DEFAULT_ACCOUNT_ID, DEFAULT_AGENT_ID, DEFAULT_BASE_BRANCH, DEFAULT_CHANNEL_ID,   DEFAULT_PROJECT_NAME, DEFAULT_REPOSITORY_PATH, DEFAULT_WORKER_LEVEL,
  LOG_DIRECTORY_NAME,
PRIMARY_CHANNEL_NAME,   PROJECTS_FIXTURE_FILE_NAME,
  PROMPT_EXTENSION,
  PROMPTS_DIRECTORY_NAME,
  WORKSPACE_TEMP_PREFIX,
} from "./const.js";
import type { HarnessOptions, TestHarness } from "./types.js";

/**
 * Persist a complete projects fixture without exposing raw writes through the production state API.
 *
 * @param workspaceDir - Isolated test workspace that owns the fixture.
 * @param data - Complete projects-registry fixture to serialize.
 */
async function writeProjectsFixture(workspaceDir: string, data: ProjectsData): Promise<void> {
  const dataDirectory = path.join(workspaceDir, DATA_DIR);

  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(path.join(dataDirectory, PROJECTS_FIXTURE_FILE_NAME), `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

/** Create an isolated project, provider and command recorder.
 * @param opts - Optional project, workflow and worker fixture choices.
 */
export async function createTestHarness(opts?: HarnessOptions): Promise<TestHarness> {
  const {
    projectName = DEFAULT_PROJECT_NAME,
    channelId = DEFAULT_CHANNEL_ID,
    repo = DEFAULT_REPOSITORY_PATH,
    baseBranch = DEFAULT_BASE_BRANCH,
    workflow: inputWorkflow = DEFAULT_WORKFLOW,
    workers: workerOverrides,
    extraProjects,
  } = opts ?? {};

  const workflow = structuredClone(inputWorkflow);
  const hasWorkflowOverride = opts?.workflow !== undefined;

  // Create temp workspace
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), WORKSPACE_TEMP_PREFIX));
  const dataDir = path.join(workspaceDir, DATA_DIR);
  const logDir = path.join(dataDir, LOG_DIRECTORY_NAME);

  await fs.mkdir(logDir, { recursive: true });

  // Build project — empty per-level workers
  const emptyRW = (): RoleWorkerState => ({ levels: {} });
  const defaultWorkers: Record<string, RoleWorkerState> = {};

  for (const role of getAllRoleIds()) defaultWorkers[role] = emptyRW();

  // Apply worker overrides: places override into levels[level][0]
  if (workerOverrides) {
    for (const [role, overrides] of Object.entries(workerOverrides)) {

      const level = overrides.level ?? DEFAULT_WORKER_LEVEL;
      const rw = defaultWorkers[role] ?? emptyRW();

      rw.levels[level] = [{
        active: overrides.active ?? false,
        issueId: overrides.issueId ?? null,
        sessionKey: overrides.sessionKey ?? null,
        startTime: overrides.startTime !== undefined ? overrides.startTime : overrides.active ? new Date().toISOString() : null,
        previousLabel: overrides.previousLabel ?? null,
        lastIssueId: overrides.lastIssueId,
      }];
      defaultWorkers[role] = rw;
    }
  }

  const project: Project = {
    slug: projectName,
    name: projectName,
    agentId: DEFAULT_AGENT_ID,
    repo,
    baseBranch,
    deployBranch: baseBranch,
    channels: [{
      channelId,
      channel: NOTIFICATION_CHANNEL.TELEGRAM,
      name: PRIMARY_CHANNEL_NAME,
      accountId: DEFAULT_ACCOUNT_ID,
    }],
    provider: ISSUE_PROVIDER.GITHUB,
    workers: defaultWorkers,
  };

  const projectsData: ProjectsData = {
    projects: {
      [projectName]: project,  // New schema: keyed by slug (projectName), not channelId
      ...extraProjects,
    },
  };

  await writeProjectsFixture(workspaceDir, projectsData);

  // Install mock runCommand
  const { interceptor, handler } = createCommandInterceptor();

  // Create test provider
  const provider = new TestProvider();

  return {
    workspaceDir,
    provider,
    /** Seed both snapshots explicitly; provider-only tests keep using provider.seedIssue.
     * @param input - Provider content and stable issue identity for the fixture.
     */
    async seedManagedIssue(input) {
      const issue = provider.seedIssue(input);
      const previous = (await readIssueStateStore(workspaceDir, project.slug)).issues[String(issue.iid)];

      if (!previous) {
        const config = await loadConfig(workspaceDir, project.slug);
        const frame = Object.entries(project.workers).flatMap(([role, worker]) => Object.entries(worker.levels).flatMap(([level, slots]) =>
          (slots ?? []).flatMap((slot, slotIndex) => slot.active && slot.issueId === issue.iid ? [{ role, level, slotIndex,
            sessionKey: slot.sessionKey, startedAt: slot.startTime ?? "" }] : [])))[0];

        await initializeIssueRuntimeState({ workspaceDir, project, issue, providerType: project.provider, workflow: hasWorkflowOverride ? workflow : config.workflow,
          initializationRoles: config.roles, reviewPolicy: config.workflow.reviewPolicy, testPolicy: config.workflow.testPolicy,
          notifyTarget: { channel: NOTIFICATION_CHANNEL.TELEGRAM, name: PRIMARY_CHANNEL_NAME }, activeWorker: frame ?? null });
        const initialized = (await readIssueStateStore(workspaceDir, project.slug)).issues[String(issue.iid)];

        if (config.workflow.states[initialized.workflowState]?.type === STATE_TYPE.ACTIVE && !initialized.activeWorker) {
          await bindWorkerForTesting(workspaceDir, project.slug, issue.iid);
        }
      }

      return issue;
    },
    commands: interceptor,
    runCommand: handler,
    channelId,
    project,
    workflow,
    /** Replace the complete registry fixture in the isolated workspace.
     * @param data - Complete registry fixture to publish.
     */
    async writeProjects(data: ProjectsData) {
      await writeProjectsFixture(workspaceDir, data);
    },
    /** Read the current registry through the production state API. */
    async readProjects() {
      return readProjects(workspaceDir);
    },
    /** Write a role instruction fixture at the default or project-specific scope.
     * @param role - Configured role whose instructions are written.
     * @param content - Exact instruction contents.
     * @param forProject - Optional project scope, otherwise workspace defaults.
     */
    async writePrompt(role: string, content: string, forProject?: string) {
      const dir = forProject
        ? path.join(dataDir, PROJECTS_DIRECTORY_NAME, forProject, PROMPTS_DIRECTORY_NAME)
        : path.join(dataDir, PROMPTS_DIRECTORY_NAME);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${role}${PROMPT_EXTENSION}`), content, "utf-8");
    },
    /** Fire the SDK hook with its resolved workspace and original mutable files.
     * @param sessionKey - Exact session identity supplied by a worker bootstrap.
     */
    async simulateBootstrap(sessionKey: string) {
      return simulateBootstrap(workspaceDir, sessionKey);
    },
    /** Remove the temporary fixture despite transient directory races from optional background effects. */
    async cleanup() {
      await fs.rm(workspaceDir, { recursive: true, force: true, maxRetries: CLEANUP_MAX_RETRIES, retryDelay: CLEANUP_RETRY_DELAY_MS });
    },
  };
}
