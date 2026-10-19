/** Builds read-only task views from authoritative local state and provider observations. */

import type { IssueRuntimeState } from "../../../domain/index.js";
import { findStateByLabel, STATE_TYPE, type WorkflowConfig } from "../../../domain/index.js";
import type { Issue } from "../../../integrations/index.js";
import { readIssueStateStore, readReadyIssueCreationIds } from "../../../state/index.js";
import { ALL_TASK_STATES, DEFAULT_TASK_LIST_LIMIT } from "./const.js";
import { summarizeLocalIssueStates } from "./issue-summary.js";
import type { ListManagedTasksInput, ProjectionViewContext, TaskListResult, TaskListStateGroup } from "./types.js";

/** State selected for a task listing. */
type FetchEntry = Pick<TaskListStateGroup, "label" | "type" | "role">;

/** List ready managed issues from local state and enrich them with provider observations.
 * @param opts - Resolved project dependencies and operation-specific input.
 */
export async function listManagedTasks(opts: ListManagedTasksInput): Promise<TaskListResult> {
  const limit = opts.limit ?? DEFAULT_TASK_LIST_LIMIT;

  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error("Task list limit must be a non-negative integer.");
  }

  const store = await readIssueStateStore(opts.workspaceDir, opts.projectSlug);
  const projectionCtx: ProjectionViewContext = { states: store.issues, workflow: opts.workflow, roles: opts.roles };
  const localStates: IssueRuntimeState[] = [];
  const ready = Object.values(store.issues).some(state => state.creationOperationId)
    ? await readReadyIssueCreationIds(opts.workspaceDir, opts.projectSlug) : new Set<string>();

  for (const state of Object.values(store.issues)) {
    if ((!state.creationOperationId || ready.has(state.creationOperationId))) {
      localStates.push(state);
    }
  }

  const labelsToFetch = resolveTaskListLabels(opts.workflow, opts.stateType, opts.label);
  const searchLower = opts.search?.toLowerCase();
  const observations = new Map<number, Issue>();
  const provider = { getIssue: async (issueId: number): Promise<Issue> => {
    const cached = observations.get(issueId);

    if (cached) return cached;
    const issue = await opts.provider.getIssue(issueId);

    observations.set(issueId, issue);

    return issue;
  } };
  const results: TaskListStateGroup[] = [];

  for (const entry of labelsToFetch) {
    let states = localStates.filter((state) => state.workflowLabel === entry.label);

    if (searchLower) {
      const filtered: IssueRuntimeState[] = [];

      for (const state of states) {
        const issue = await provider.getIssue(state.issueId);

        if (issue.title.toLowerCase().includes(searchLower)) {
          filtered.push(state);
        }
      }

      states = filtered;
    }

    const total = states.length;
    const limited = states.slice(0, limit);

    results.push({
      label: entry.label,
      type: entry.type,
      role: entry.role,
      issues: await summarizeLocalIssueStates(limited, provider, projectionCtx),
      total,
    });
  }

  return {
    filter: { stateType: opts.stateType ?? null, label: opts.label ?? null, search: opts.search ?? null },
    states: opts.label ? results : results.filter((r) => r.total > 0),
    totalIssues: results.reduce((sum, r) => sum + r.total, 0),
  };
}

/** Select configured workflow labels, excluding terminal states by default.
 * @param workflow - Effective project workflow including custom states.
 * @param stateType - Optional workflow classification filter.
 * @param label - Provider-visible workflow label selected by configuration.
 */
function resolveTaskListLabels(workflow: WorkflowConfig, stateType?: ListManagedTasksInput["stateType"], label?: string): FetchEntry[] {
  if (label) {
    const stateConfig = findStateByLabel(workflow, label);

    if (!stateConfig) throw new Error(`Unknown state label "${label}". Check workflow_guide for valid states.`);

    return [{
      label: stateConfig.label,
      type: stateConfig.type,
      role: stateConfig.role,
    }];
  }

  const includeTerminal = stateType === STATE_TYPE.TERMINAL || stateType === ALL_TASK_STATES;
  const entries: FetchEntry[] = [];

  for (const state of Object.values(workflow.states)) {
    if (state.type === STATE_TYPE.TERMINAL && !includeTerminal) continue;
    if (stateType && stateType !== ALL_TASK_STATES && state.type !== stateType) continue;
    entries.push({
      label: state.label,
      type: state.type,
      role: state.role,
    });
  }

  return entries;
}
