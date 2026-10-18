/**
 * Defines persisted contracts for resumable managed-issue creation operations.
 */

import type { IssueProviderId, NotifyBindingRef, ReviewPolicy, TestPolicy } from "../../../domain/index.js";
import type { ValueOf } from "../../../types.js";
import { ISSUE_CREATION_ERROR, ISSUE_CREATION_STATUS } from "./const.js";

/** Durable stage of a resumable managed-issue creation operation. */
export type IssueCreationStatus = ValueOf<typeof ISSUE_CREATION_STATUS>;

/** Stable failure identifier persisted with a managed-issue creation operation. */
export type IssueCreationErrorCode = ValueOf<typeof ISSUE_CREATION_ERROR>;

/** Persisted input required to resume issue creation. */
type IssueCreationInput = {
  /** Provider issue title. */
  title: string;
  /** Provider issue body. */
  body: string;
  /** Provider usernames assigned on creation. */
  assignees: string[];
  /** Initial canonical workflow state key. */
  workflowState: string;
  /** Initial provider-facing workflow label. */
  workflowLabel: string;
  /** Resolved worker role. */
  assignedRole: string | null;
  /** Resolved worker level. */
  assignedLevel: string | null;
  /** DevClaw instance owner. */
  owner: string | null;
  /** Resolved review-routing policy. */
  reviewPolicy: ReviewPolicy;
  /** Resolved test-routing policy. */
  testPolicy: TestPolicy;
  /** Explicit notification binding. */
  notifyTarget: NotifyBindingRef | null;
  /** Provider selected by project configuration. */
  provider: IssueProviderId;
};

/** Provider identity retained after create succeeds. */
type CreatedProviderIssueRef = {
  /** Provider-local issue identifier. */
  issueId: number;
  /** Canonical provider URL. */
  url: string;
  /** ISO creation timestamp. */
  createdAt: string;
};

/** Last durable failure associated with a creation operation. */
export type IssueCreationFailure = {
  /** Stable recovery error identifier. */
  code: IssueCreationErrorCode;
  /** Operator-facing description. */
  message: string;
  /** Whether automatic recovery may retry. */
  retryable: boolean;
  /** Earliest ISO retry timestamp. */
  retryAfter?: string;
};

/** Durable saga record for one issue creation lifecycle. */
export type IssueCreationOperation = {
  /** Unique operation identifier. */
  operationId: string;
  /** Caller-supplied deduplication key. */
  idempotencyKey: string;
  /** Hash preventing conflicting key reuse. */
  payloadHash: string;
  /** Owning project slug. */
  projectSlug: string;
  /** Actor that requested creation. */
  requestedBy: string;
  /** Initial ISO request timestamp. */
  requestedAt: string;
  /** Latest ISO mutation timestamp. */
  updatedAt: string;
  /** Current durable saga stage. */
  status: IssueCreationStatus;
  /** Validated creation input. */
  input: IssueCreationInput;
  /** Expected provider labels. */
  expectedLabels: string[];
  /** Provider identity after successful creation. */
  providerIssue?: CreatedProviderIssueRef;
  /** Completed idempotent saga steps. */
  completedSteps: string[];
  /** Remaining saga steps. */
  pendingSteps: string[];
  /** Provider or recovery attempt count. */
  attempts: number;
  /** Number of scheduled reconciliation attempts; absent until the first such attempt. */
  reconciliationAttempts?: number;
  /** Earliest ISO retry timestamp. */
  retryAfter?: string;
  /** Most recent durable failure. */
  lastError?: IssueCreationFailure;
  /** Correlation identifier shared by audit events. */
  auditCorrelationId: string;
};

/** Current project-local creation operation store. */
export type IssueCreationStore = {
  /** Project slug that owns every operation. */
  projectSlug: string;
  /** Operations keyed by idempotency key. */
  operations: Record<string, IssueCreationOperation>;
};

/** Immutable creation-store update with the persisted replacement and result. */
export type IssueCreationUpdate<T> = {
  /** Complete creation store replacement. */
  store: IssueCreationStore;
  /** Value returned after persistence succeeds. */
  result: T;
};
