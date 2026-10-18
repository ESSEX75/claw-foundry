/**
 * workflow/types.ts — Domain types for workflow statecharts and resolved transitions.
 */

import type { ValueOf } from "../../types.js";
import type { RoleId } from "../roles/index.js";
import {
  ACTION,
  COMPLETION_RESULT,
  EXECUTION_MODE,
  REVIEW_CHECK,
  STATE_TYPE,
  WORKFLOW_EVENT,
  WORKFLOW_STATE_KEYS,
  WORKFLOW_STATE_LABELS,
} from "./const.js";
import type { ReviewPolicy, TestPolicy } from "./routing/index.js";

/** Built-in workflow state key; validated custom keys belong to WorkflowConfig. */
export type WorkflowStateKey = ValueOf<typeof WORKFLOW_STATE_KEYS>;

/** Built-in workflow display label; resolved runtime workflows may define custom labels. */
export type WorkflowLabel = ValueOf<typeof WORKFLOW_STATE_LABELS>;

/** Union type for execution mode (parallel or sequential). */
export type ExecutionMode = ValueOf<typeof EXECUTION_MODE>;

/** Union type for workflow transition events (e.g. PICKUP, COMPLETE). */
export type WorkflowEvent = ValueOf<typeof WORKFLOW_EVENT>;

/** Built-in worker completion result identifier. */
export type CompletionResult = ValueOf<typeof COMPLETION_RESULT>;

/** Explicit mapping from role completion results to workflow events. */
export type CompletionEventMap = Readonly<Record<string, WorkflowEvent>>;

/** Action identifier executed during transitions (e.g. gitPull, mergePr). */
export type TransitionAction = ValueOf<typeof ACTION>;

/** Union of possible PR review check types. */
export type ReviewCheckType = ValueOf<typeof REVIEW_CHECK>;

/** Configuration for a workflow event transition. */
export type TransitionTarget<TStateKey extends string> = {
  /** Target workflow state key to transition to. */
  target: TStateKey;
  /** List of actions to execute during transition. */
  actions?: TransitionAction[];
  /** Optional description of why/when this transition occurs. */
  description?: string;
};

/** Fields shared by every workflow state. */
type BaseStateConfig<TLabel extends string> = {
  /** Provider-side display label matching this state. */
  label: TLabel;
  /** Hex color code for the state label. */
  color: string;
  /** Human-readable explanation of this state's purpose. */
  description?: string;
  /** Mandatory check condition before transitioning (e.g. prApproved). */
  check?: ReviewCheckType;
};

/** Outgoing transitions supported by non-terminal workflow states. */
type StatefulTransitions<TStateKey extends string> = {
  /** Map of workflow events to their transition targets. */
  on?: Partial<Record<WorkflowEvent, TransitionTarget<TStateKey>>>;
};

/** Queue state waiting for a role to pick up work. */
type QueueStateConfig<
  TRoleId extends string,
  TStateKey extends string,
  TLabel extends string,
> = BaseStateConfig<TLabel> & StatefulTransitions<TStateKey> & {
  /** Queue behavior discriminator. */
  type: typeof STATE_TYPE.QUEUE;
  /** Worker role responsible for this queue. */
  role: TRoleId;
  /** Priority ordering for processing. */
  priority?: number;
};

/** Active state currently processed by a worker role. */
type ActiveStateConfig<
  TRoleId extends string,
  TStateKey extends string,
  TLabel extends string,
> = BaseStateConfig<TLabel> & StatefulTransitions<TStateKey> & {
  /** Active behavior discriminator. */
  type: typeof STATE_TYPE.ACTIVE;
  /** Worker role responsible for active processing. */
  role: TRoleId;
  /** Priority is meaningful only for queue states. */
  priority?: never;
};

/** Hold state waiting for an external or human decision. */
type HoldStateConfig<
  TStateKey extends string,
  TLabel extends string,
> = BaseStateConfig<TLabel> & StatefulTransitions<TStateKey> & {
  /** Hold behavior discriminator. */
  type: typeof STATE_TYPE.HOLD;
  /** Hold states are not assigned to worker roles. */
  role?: never;
  /** Priority is meaningful only for queue states. */
  priority?: never;
};

/** Terminal state concluding the workflow. */
type TerminalStateConfig<
  TLabel extends string,
> = BaseStateConfig<TLabel> & {
  /** Terminal behavior discriminator. */
  type: typeof STATE_TYPE.TERMINAL;
  /** Terminal states are not assigned to worker roles. */
  role?: never;
  /** Priority is meaningful only for queue states. */
  priority?: never;
  /** Terminal states cannot have outgoing transitions. */
  on?: never;
};

/** Configuration for a single state in the workflow statechart. */
export type StateDefinition<
  TRoleId extends string,
  TStateKey extends string,
  TLabel extends string,
> =
  | QueueStateConfig<TRoleId, TStateKey, TLabel>
  | ActiveStateConfig<TRoleId, TStateKey, TLabel>
  | HoldStateConfig<TStateKey, TLabel>
  | TerminalStateConfig<TLabel>;

/** Full workflow statechart configuration. */
export type WorkflowDefinition<
  TRoleId extends string,
  TStateKey extends string,
  TLabel extends string,
> = {
  /** Initial workflow state key for new issues. */
  initial: TStateKey;
  /** Default review policy for PRs. */
  reviewPolicy?: ReviewPolicy;
  /** Default test policy for completed PRs. */
  testPolicy?: TestPolicy;
  /** Role execution mode (parallel or sequential). */
  roleExecution?: ExecutionMode;
  /** Default max workers per level across all roles. Default: 2. */
  maxWorkersPerLevel?: number;
  /** Map of state keys to their state configurations. */
  states: Record<TStateKey, StateDefinition<TRoleId, TStateKey, TLabel>>;
};

/** Strict configuration contract for the built-in workflow. */
export type BuiltInWorkflowConfig = WorkflowDefinition<
  RoleId,
  WorkflowStateKey,
  WorkflowLabel
>;

/** Workflow configuration after runtime validation and layer resolution. */
export type WorkflowConfig = WorkflowDefinition<string, string, string>;

/** State configuration belonging to a validated runtime workflow. */
export type WorkflowStateConfig = StateDefinition<string, string, string>;

/** Configured workflow edge resolved to canonical identities and display metadata. */
export type WorkflowTransition<TStateKey extends string, TLabel extends string> = {
  /** Canonical source state key. */
  fromState: TStateKey;
  /** Configured source display label. */
  fromLabel: TLabel;
  /** Canonical destination state key. */
  toState: TStateKey;
  /** Configured destination display label. */
  toLabel: TLabel;
  /** Destination description, falling back to its label. */
  description: string;
  /** Independent action sequence selected by the configured edge. */
  actions: TransitionAction[];
};

/** Rule mapping a specific completion scenario to the next state and actions. */
export type CompletionRule<TLabel extends string = WorkflowLabel> = {
  /** Source workflow label. */
  from: TLabel;
  /** Destination workflow label. */
  to: TLabel;
  /** Actions to execute upon completing transition. */
  actions: TransitionAction[];
};
