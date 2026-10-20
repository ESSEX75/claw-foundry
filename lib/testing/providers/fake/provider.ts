/**
 * Models provider observations and explicit mutations entirely in memory for tests.
 * Call evidence is snapshotted; workflow decisions remain in production application code.
 */
/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

import type { CreateIssueInput, Issue, IssueComment, IssueProvider, PrReviewComment, PrStatus, StateLabel } from "../../../integrations/index.js";
import { PROVIDER_ISSUE_LOOKUP_ERROR, ProviderIssueLookupError } from "../../../integrations/index.js";
import { FAKE_COMMENT_AUTHOR,FAKE_ISSUE_URL_PREFIX, FAKE_PROVIDER_ID } from "./const.js";
import type { AttachmentUpload, IssueListOptions, IssueSeed, IssueUpdates, ProviderCall, ProviderCallFor } from "./types.js";


/** Deterministic provider effects and call snapshots; workflow decisions remain application-owned. */
export class TestProvider implements IssueProvider {
  /** All issues keyed by iid. */
  issues = new Map<number, Issue>();
  /** Comments per issue. */
  comments = new Map<number, IssueComment[]>();
  /** Labels that have been ensured. */
  labels = new Map<string, string>();
  /** PR status overrides per issue. Default: { state: "closed", url: null }. */
  prStatuses = new Map<number, PrStatus>();
  /** Merged MR URLs per issue. */
  mergedMrUrls = new Map<number, string>();
  /** Issue IDs where mergePr should fail (simulates merge conflicts). */
  mergePrFailures = new Set<number>();
  /** PR diffs per issue (for reviewer tests). */
  prDiffs = new Map<number, string>();
  /** All calls, in order. */
  calls: ProviderCall[] = [];

  /** Next issue identity, advanced by explicit seed identities. */
  private nextIssueId = 1;
  /** Monotonic comment identity independent of wall-clock resolution. */
  private nextCommentId = 1;
  // -------------------------------------------------------------------------
  // Test helpers
  // -------------------------------------------------------------------------

  /** Retain invocation-time payloads even when callers subsequently mutate their data.
   * @param call - Discriminated provider invocation evidence.
   */
  private recordCall(call: ProviderCall): void {
    this.calls.push(structuredClone(call));
  }

  /** Create an issue directly in the store (bypasses createIssue tracking).
   * @param overrides - Explicit provider issue identity and optional snapshot fields.
   */
  seedIssue(overrides: IssueSeed): Issue {
    const issue: Issue = {
      iid: overrides.iid,
      title: overrides.title ?? `Issue #${overrides.iid}`,
      description: overrides.description ?? "",
      labels: [...(overrides.labels ?? [])],
      state: overrides.state ?? "opened",
      web_url:
        overrides.web_url ?? `${FAKE_ISSUE_URL_PREFIX}${overrides.iid}`,
    };

    this.issues.set(issue.iid, issue);
    if (issue.iid >= this.nextIssueId) this.nextIssueId = issue.iid + 1;

    return issue;
  }

  /** Set PR status for an issue (used by review pass tests).
   * @param issueId - Provider-local issue identity.
   * @param status - Deterministic request status to seed.
   */
  setPrStatus(issueId: number, status: PrStatus): void {
    this.prStatuses.set(issueId, status);
  }

  /** Get calls filtered by method name.
   * @param method - Provider method selecting narrowed call evidence.
   */
  callsTo<M extends ProviderCall["method"]>(
    method: M,
  ): ProviderCallFor<M>[] {
    return this.calls.filter((call): call is ProviderCallFor<M> => call.method === method);
  }

  /** Reset call tracking (keeps issue state). */
  resetCalls(): void {
    this.calls = [];
  }

  /** Full reset — clear everything. */
  reset(): void {
    this.issues.clear();
    this.comments.clear();
    this.labels.clear();
    this.prStatuses.clear();
    this.mergedMrUrls.clear();
    this.mergePrFailures.clear();
    this.prDiffs.clear();
    this.calls = [];
    this.nextIssueId = 1;
    this.nextCommentId = 1;
  }

  // -------------------------------------------------------------------------
  // IssueProvider implementation
  // -------------------------------------------------------------------------

  /** Record an explicit label definition without selecting workflow state.
   * @param name - Exact provider label name.
   * @param color - Explicit label color.
   */
  async ensureLabel(name: string, color: string): Promise<void> {
    this.recordCall({ method: "ensureLabel", args: { name, color } });
    this.labels.set(name, color);
  }

  /** Create a provider-only issue and snapshot the submitted payload.
   * @param input - Complete provider issue creation payload.
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    this.recordCall({
      method: "createIssue",
      args: input,
    });
    const iid = this.nextIssueId++;
    const issue: Issue = {
      iid,
      title: input.title,
      description: input.body,
      labels: [...input.labels],
      state: "opened",
      web_url: `${FAKE_ISSUE_URL_PREFIX}${iid}`,
    };

    this.issues.set(iid, issue);

    return issue;
  }

  /** Observe provider issues containing an exact label.
   * @param label - Exact label to observe or add.
   */
  async listIssuesByLabel(label: StateLabel): Promise<Issue[]> {
    this.recordCall({ method: "listIssuesByLabel", args: { label } });

    return [...this.issues.values()].filter((i) => i.labels.includes(label));
  }

  /** Observe provider issues using the requested label and lifecycle filters.
   * @param opts - Optional provider observation filters.
   */
  async listIssues(opts?: IssueListOptions): Promise<Issue[]> {
    this.recordCall({ method: "listIssues", args: { label: opts?.label, state: opts?.state } });
    let issues = [...this.issues.values()];

    if (opts?.label) issues = issues.filter((i) => i.labels.includes(opts.label!));
    if (opts?.state === "open") issues = issues.filter((i) => i.state === "opened" || i.state === "OPEN");
    else if (opts?.state === "closed") issues = issues.filter((i) => i.state === "closed" || i.state === "CLOSED");

    return issues;
  }

  /** Read a seeded issue or report typed confirmed absence.
   * @param issueId - Provider-local issue identity.
   */
  async getIssue(issueId: number): Promise<Issue> {
    this.recordCall({ method: "getIssue", args: { issueId } });
    const issue = this.issues.get(issueId);

    if (!issue) {
      throw new ProviderIssueLookupError({
        code: PROVIDER_ISSUE_LOOKUP_ERROR.ISSUE_NOT_FOUND,
        provider: FAKE_PROVIDER_ID,
        retryable: false,
        status: 404,
        message: `Issue #${issueId} not found in TestProvider`,
      });
    }

    return issue;
  }

  /** Read the seeded comments for one provider issue.
   * @param issueId - Provider-local issue identity.
   */
  async listComments(issueId: number): Promise<IssueComment[]> {
    this.recordCall({ method: "listComments", args: { issueId } });

    return this.comments.get(issueId) ?? [];
  }

  /** Model only explicit label additions selected by application orchestration.
   * @param issueId - Fake provider identity.
   * @param labels - Exact labels to add.
   */
  async addLabels(issueId: number, labels: string[]): Promise<void> {
    this.recordCall({ method: "addLabels", args: { issueId, labels } });
    const issue = this.issues.get(issueId);

    if (!issue) throw new Error(`Issue #${issueId} not found in TestProvider`);
    for (const label of labels) if (!issue.labels.includes(label)) issue.labels.push(label);
  }

  /** Apply one explicit label when the provider issue exists.
   * @param issueId - Provider-local issue identity.
   * @param label - Exact label to observe or add.
   */
  async addLabel(issueId: number, label: string): Promise<void> {
    this.recordCall({ method: "addLabel", args: { issueId, label } });
    const issue = this.issues.get(issueId);

    if (issue && !issue.labels.includes(label)) {
      issue.labels.push(label);
    }
  }

  /** Remove only the explicit labels supplied by the caller.
   * @param issueId - Provider-local issue identity.
   * @param labels - Exact provider labels selected by the caller.
   */
  async removeLabels(issueId: number, labels: string[]): Promise<void> {
    this.recordCall({ method: "removeLabels", args: { issueId, labels } });
    const issue = this.issues.get(issueId);

    if (issue) {
      issue.labels = issue.labels.filter((l) => !labels.includes(l));
    }
  }

  /** Mark an existing provider issue closed without changing managed runtime.
   * @param issueId - Provider-local issue identity.
   */
  async closeIssue(issueId: number): Promise<void> {
    this.recordCall({ method: "closeIssue", args: { issueId } });
    const issue = this.issues.get(issueId);

    if (issue) issue.state = "closed";
  }

  /** Mark an existing provider issue open without changing managed runtime.
   * @param issueId - Provider-local issue identity.
   */
  async reopenIssue(issueId: number): Promise<void> {
    this.recordCall({ method: "reopenIssue", args: { issueId } });
    const issue = this.issues.get(issueId);

    if (issue) issue.state = "opened";
  }

  /** Advertise the fake provider deletion capability. */
  supportsIssueDeletion(): boolean { return true; }

  /** Delete a provider snapshot without touching managed local state.
   * @param issueId - Provider-local issue identity.
   */
  async deleteIssue(issueId: number): Promise<void> {
    this.recordCall({ method: "deleteIssue", args: { issueId } });
    this.issues.delete(issueId);
  }

  /** Return an explicitly seeded merged request URL or confirmed absence.
   * @param issueId - Provider-local issue identity.
   */
  async getMergedMRUrl(issueId: number): Promise<string | null> {
    this.recordCall({ method: "getMergedMRUrl", args: { issueId } });

    return this.mergedMrUrls.get(issueId) ?? null;
  }

  /** Return the seeded observation and record exact-request lookup arguments for assertions.
   * @param issueId - Issue whose deterministic status is seeded in this fake.
   * @param prUrl - Exact request identity supplied by the application, when captured.
   */
  async getPrStatus(issueId: number, prUrl?: string): Promise<PrStatus> {
    this.recordCall({ method: "getPrStatus", args: { issueId, prUrl } });

    return this.prStatuses.get(issueId) ?? { state: "closed", url: null };
  }

  /** Record the selected request and simulate either a successful merge or confirmed conflict.
   * @param issueId - Issue whose PR fixture is being merged.
   * @param prUrl - Exact request identity selected by the application.
   */
  async mergePr(issueId: number, prUrl?: string): Promise<void> {
    this.recordCall({ method: "mergePr", args: { issueId, prUrl } });
    if (this.mergePrFailures.has(issueId)) {
      const observed = this.prStatuses.get(issueId);

      if (observed) this.prStatuses.set(issueId, { ...observed, mergeable: false });
      throw new Error(`Merge conflict: cannot merge PR for issue #${issueId}`);
    }

    // Simulate successful merge — update PR status to merged
    const existing = this.prStatuses.get(issueId);

    if (existing) {
      this.prStatuses.set(issueId, { state: "merged", url: existing.url });
    }
  }

  /** Return an explicitly seeded diff and record the selected request.
   * @param issueId - Provider-local issue identity.
   * @param prUrl - Exact observed request selected by the caller.
   */
  async getPrDiff(issueId: number, prUrl?: string): Promise<string | null> {
    this.recordCall({ method: "getPrDiff", args: { issueId, prUrl } });

    return this.prDiffs.get(issueId) ?? null;
  }

  /** Record review inspection; the default fake has no review comments.
   * @param issueId - Provider-local issue identity.
   * @param prUrl - Exact observed request selected by the caller.
   */
  async getPrReviewComments(issueId: number, prUrl?: string): Promise<PrReviewComment[]> {
    this.recordCall({ method: "getPrReviewComments", args: { issueId, prUrl } });

    return [];
  }

  /** Accept a cosmetic issue acknowledgement without external effects.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async reactToIssue(_issueId: number, _emoji: string): Promise<void> {
    // no-op in test provider
  }

  /** Model the default already-initialized issue acknowledgement.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async issueHasReaction(_issueId: number, _emoji: string): Promise<boolean> {
    return true; // test provider assumes all issues are "new style"
  }

  /** Accept a cosmetic request acknowledgement without external effects.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async reactToPr(_issueId: number, _emoji: string): Promise<void> {
    // no-op in test provider
  }

  /** Model the default already-initialized request acknowledgement.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async prHasReaction(_issueId: number, _emoji: string): Promise<boolean> {
    return true; // test provider assumes all PRs are "new style"
  }

  /** Accept an issue-comment acknowledgement without external effects.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _commentId - Provider comment identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async reactToIssueComment(_issueId: number, _commentId: number, _emoji: string): Promise<void> {
    // no-op in test provider
  }

  /** Accept a request-comment acknowledgement without external effects.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _commentId - Provider comment identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async reactToPrComment(_issueId: number, _commentId: number, _emoji: string): Promise<void> {
    // no-op in test provider
  }

  /** Accept inline comment acknowledgement without external effects.
   * @param _issueId - Owning issue identifier.
   * @param _commentId - Provider inline comment identifier.
   * @param _emoji - Requested reaction.
   */
  async reactToPrReviewComment(_issueId: number, _commentId: number, _emoji: string): Promise<void> {
    // no-op in test provider
  }

  /** Model an unacknowledged issue comment by default.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _commentId - Provider comment identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async issueCommentHasReaction(_issueId: number, _commentId: number, _emoji: string): Promise<boolean> {
    return false; // test provider: no existing reactions
  }

  /** Model an unacknowledged request comment by default.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _commentId - Provider comment identity, unused by this default stub.
   * @param _emoji - Cosmetic acknowledgement symbol, unused by this default stub.
   */
  async prCommentHasReaction(_issueId: number, _commentId: number, _emoji: string): Promise<boolean> {
    return false; // test provider: no existing reactions
  }

  /** Report inline comments as unmarked in the default test provider.
   * @param _issueId - Owning issue identifier.
   * @param _commentId - Provider inline comment identifier.
   * @param _emoji - Requested reaction.
   */
  async prReviewCommentHasReaction(_issueId: number, _commentId: number, _emoji: string): Promise<boolean> {
    return false; // test provider: no existing reactions
  }

  /** Model absent merge evidence unless a test overrides this observation.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _baseBranch - Base branch whose commit evidence is absent by default.
   */
  async isCommitOnBaseBranch(_issueId: number, _baseBranch: string): Promise<boolean> {
    return false; // no-op in test provider
  }

  /** Allocate a distinct comment identity and capture its submitted body.
   * @param issueId - Provider-local issue identity.
   * @param body - Complete submitted comment text.
   */
  async addComment(issueId: number, body: string): Promise<number> {
    this.recordCall({ method: "addComment", args: { issueId, body } });
    while ([...this.comments.values()].some(comments => comments.some(comment => comment.id === this.nextCommentId))) this.nextCommentId++;
    const commentId = this.nextCommentId++;
    const existing = this.comments.get(issueId) ?? [];

    existing.push({
      id: commentId,
      author: FAKE_COMMENT_AUTHOR,
      body,
      created_at: new Date().toISOString(),
    });
    this.comments.set(issueId, existing);

    return commentId;
  }

  /** Apply explicit title and body changes to an existing provider snapshot.
   * @param issueId - Provider-local issue identity.
   * @param updates - Explicit replacement issue fields.
   */
  async editIssue(issueId: number, updates: IssueUpdates): Promise<Issue> {
    this.recordCall({ method: "editIssue", args: { issueId, updates } });
    const issue = this.issues.get(issueId);

    if (!issue) throw new Error(`Issue #${issueId} not found in TestProvider`);
    if (updates.title !== undefined) issue.title = updates.title;
    if (updates.body !== undefined) issue.description = updates.body;

    return issue;
  }

  /** Model unsupported attachment upload without filesystem or provider effects.
   * @param _issueId - Provider-local issue identity, unused by this default stub.
   * @param _file - Attachment payload ignored by the unsupported upload stub.
   */
  async uploadAttachment(
    _issueId: number,
    _file: AttachmentUpload,
  ): Promise<string | null> {
    return null;
  }

  /** Record a successful fake provider health observation. */
  async healthCheck(): Promise<boolean> {
    this.recordCall({ method: "healthCheck", args: {} });

    return true;
  }
}
