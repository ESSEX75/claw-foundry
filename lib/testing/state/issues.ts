/**
 * Seeds validated Claw Foundry stores through their locked public update boundaries for tests.
 */

import { initializeIssueRuntimeState, type IssueStateInitializeInput, writeIssueRuntimeState } from "../../application/index.js";
import { type ActiveIssueWorker, emptySlot, type IssueRuntimeState, STATE_TYPE } from "../../domain/index.js";
import type { IssueArchiveStore, IssueStateStore } from "../../state/index.js";
import { getRoleWorker, loadConfig, readIssueStateStore, updateIssueArchiveStore, updateIssueRuntimeRecord, updateIssueStateStore, updateProjects } from "../../state/index.js";
import { PREFERRED_WORKER_LEVEL, WORKER_SESSION_PREFIX } from "./const.js";

/**
 * Build an empty active issue store for one test project.
 *
 * @param projectSlug - Canonical project that owns the fixture.
 */
export function createEmptyIssueStateStoreForTesting(projectSlug: string): IssueStateStore {
  return { projectSlug, issues: {} };
}

/**
 * Replace active issue state through the same locked boundary used by production mutations.
 *
 * @param workspaceDir - Isolated test workspace containing state fixtures.
 * @param projectSlug - Canonical project that owns the fixture.
 * @param store - Complete active issue store used by the test.
 */
export async function replaceIssueStateStoreForTesting(
  workspaceDir: string,
  projectSlug: string,
  store: IssueStateStore,
): Promise<void> {
  await updateIssueStateStore(workspaceDir, projectSlug, () => ({ store, result: undefined }));
}

/**
 * Replace archived issue state through the same locked boundary used by production mutations.
 *
 * @param workspaceDir - Isolated test workspace containing state fixtures.
 * @param projectSlug - Canonical project that owns the fixture.
 * @param store - Complete archive store used by the test.
 */
export async function replaceIssueArchiveStoreForTesting(
  workspaceDir: string,
  projectSlug: string,
  store: IssueArchiveStore,
): Promise<void> {
  await updateIssueArchiveStore(workspaceDir, projectSlug, () => ({ store, result: undefined }));
}

/** Explicitly seed or update managed fixtures without adding production initialization fallback.
 * @param input - Complete test initialization choices or changes to an existing fixture.
 */
export async function seedIssueRuntimeState(input: IssueStateInitializeInput): Promise<IssueRuntimeState> {
  const previous = (await readIssueStateStore(input.workspaceDir, input.project.slug)).issues[String(input.issue.iid)];

  return previous ? writeIssueRuntimeState(input) : initializeIssueRuntimeState(input);
}

/** Bind an active-state test fixture to one exact project slot without running a gateway turn.
 * @param workspaceDir - Isolated test workspace.
 * @param projectSlug - Fixture project whose slot belongs to the issue.
 * @param issueId - Locally initialized active issue needing an explicit worker fixture.
 */
export async function bindWorkerForTesting(workspaceDir: string, projectSlug: string, issueId: number): Promise<ActiveIssueWorker> {
  const state = (await readIssueStateStore(workspaceDir, projectSlug)).issues[String(issueId)];

  if (!state) throw new Error("Initialize the managed fixture before binding its worker.");
  if (state.activeWorker) return state.activeWorker;
  const config = await loadConfig(workspaceDir, projectSlug);
  const active = config.workflow.states[state.workflowState];

  if (active?.type !== STATE_TYPE.ACTIVE || active.label !== state.workflowLabel) throw new Error("Worker fixtures require an exact configured active state.");
  const role = active.role;
  const level = state.assignedRole === role && state.assignedLevel ? state.assignedLevel
    : config.roles[role]?.levels[PREFERRED_WORKER_LEVEL] ? PREFERRED_WORKER_LEVEL : Object.keys(config.roles[role]?.levels ?? {})[0];

  if (!level) throw new Error("Worker fixture role has no configured levels.");
  const worker = await updateProjects(workspaceDir, current => {
    const data = structuredClone(current);
    const project = data.projects[projectSlug];

    if (!project) throw new Error("Worker fixture project is not registered.");
    const roleWorker = getRoleWorker(project, role);
    const slots = roleWorker.levels[level] ?? [];
    const occupied = slots.findIndex(slot => slot.issueId === issueId);
    const slotIndex = occupied >= 0 ? occupied : slots.length;
    const slot = slots[slotIndex] ?? emptySlot();
    const selected = { ...slot, active: true, issueId, sessionKey: slot.sessionKey ?? `${WORKER_SESSION_PREFIX}:${projectSlug}:${role}:${issueId}`,
      startTime: slot.startTime ?? new Date().toISOString() };

    slots[slotIndex] = selected;
    roleWorker.levels[level] = slots;
    project.workers[role] = roleWorker;

    return { data, result: { role, level, slotIndex, sessionKey: selected.sessionKey, startedAt: selected.startTime } };
  });

  await updateIssueRuntimeRecord(workspaceDir, projectSlug, issueId, previous => {
    if (!previous) throw new Error("Worker fixture issue disappeared.");

    return { ...previous, activeWorker: worker };
  });

  return worker;
}
