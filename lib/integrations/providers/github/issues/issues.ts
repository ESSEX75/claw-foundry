/** Owns GitHub issues operations and their provider-specific API semantics. */

import { ISSUE_PROVIDER } from "../../../../domain/index.js";
import type { CreateIssueInput, Issue, IssueComment, IssueEditInput, IssueListFilter, StateLabel } from "../../contracts/index.js";
import { PROVIDER_COLLECTION_STATE } from "../../contracts/index.js";
import {
  classifyProviderLookupFailure,
  classifyProviderOperationError,
  classifyProviderProjectAccessFailure,
  mayBeMissingProviderIssue,
  PROVIDER_ISSUE_LOOKUP_ERROR,
  PROVIDER_OPERATION_ERROR,
  ProviderIssueLookupError,
  ProviderOperationError,
} from "../../errors/index.js";
import type { ProviderTransport } from "../../transport/index.js";
import { PROVIDER_CLI_COMMAND, PROVIDER_CLI_OPTION,PROVIDER_HTTP_METHOD, ProviderResourceIdentitySchema } from "../../transport/index.js";
import { GITHUB_API_FIELD,GITHUB_API_QUERY, GITHUB_API_RESOURCE, GITHUB_REQUEST_STATE, githubApiPath } from "../api/index.js";
import { GhCommentSchema } from "../comments/index.js";
import { GITHUB_CREATED_ISSUE_URL_PATTERN, GITHUB_ISSUE_QUERY } from "./const.js";
import { toIssue } from "./mappers.js";
import { GhIssueSchema, GhRestIssueSchema } from "./schema.js";

/** Implements the issues capability using dependencies shared by one adapter instance. */
export class GitHubIssues {
  /** Bind the concrete capability to its owning adapter.
   * @param transport - Instance-owned checked command transport.
   */
  constructor(private readonly transport: ProviderTransport) {}

  /** Submit one issue creation; an unidentified or lost response never authorizes replay.
   * @param input - Complete application-selected issue payload for one creation attempt.
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    try {
      const args = [PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.CREATE, PROVIDER_CLI_OPTION.TITLE, input.title, PROVIDER_CLI_OPTION.BODY, input.body];

      if (input.labels.length) args.push(PROVIDER_CLI_OPTION.LABEL, input.labels.join(","));
      if (input.assignees.length) args.push(PROVIDER_CLI_OPTION.ASSIGNEE, input.assignees.join(","));
      const url = await this.transport.once(args);
      const match = url.match(GITHUB_CREATED_ISSUE_URL_PATTERN);

      if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0) {
        throw new ProviderOperationError({ code: PROVIDER_OPERATION_ERROR.UNKNOWN, message: "Issue creation returned no confirmed identity.",
          retryable: false, outcomeUnknown: true });
      }

      return {
        iid: parseInt(match[1], 10),
        title: input.title,
        description: input.body,
        labels: [...input.labels],
        state: GITHUB_REQUEST_STATE.OPEN,
        web_url: url,
      };
    } catch (error) {
      throw classifyProviderOperationError(error);
    }
  }

  /** List all open issues carrying the requested provider-visible label.
   * @param label - Provider label used as a read-only filter.
   */
  async listIssuesByLabel(label: StateLabel): Promise<Issue[]> {
    return this.listIssues({ label, state: PROVIDER_COLLECTION_STATE.OPEN });
  }

  /** Read every matching issue page; pull requests returned by the REST issues endpoint are excluded.
   * @param opts - Provider-side issue state and label filters.
   */
  async listIssues(opts?: IssueListFilter): Promise<Issue[]> {
    const label = opts?.label ? `&${GITHUB_API_QUERY.LABELS}=${encodeURIComponent(opts.label)}` : "";
    const issues = await this.transport.collection(
      `${githubApiPath(GITHUB_API_RESOURCE.ISSUES)}?${GITHUB_API_QUERY.STATE}=${opts?.state ?? PROVIDER_COLLECTION_STATE.OPEN}${label}`,
      GhRestIssueSchema,
    );

    return issues.filter(issue => issue.pull_request === undefined).map(issue => toIssue({ ...issue, url: issue.html_url }));
  }

  /** Read a validated issue, distinguishing missing identity from failed repository access.
   * @param issueId - Provider-local issue identity within the configured repository.
   */
  async getIssue(issueId: number): Promise<Issue> {
    try {
      const raw = await this.transport.read([PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.VIEW, String(issueId), PROVIDER_CLI_OPTION.JSON, GITHUB_ISSUE_QUERY.ISSUE_FIELDS]);
      const parsed: unknown = JSON.parse(raw);

      const issue = toIssue(GhIssueSchema.parse(parsed));

      if (issue.iid !== issueId) throw new ProviderIssueLookupError({ code: PROVIDER_ISSUE_LOOKUP_ERROR.UNKNOWN,
        provider: ISSUE_PROVIDER.GITHUB, retryable: false, message: "Provider returned another issue identity for the selected lookup." });

      return issue;
    } catch (error) {
      if (error instanceof ProviderIssueLookupError) throw error;
      if (mayBeMissingProviderIssue(error)) {
        try {
          await this.transport.read([PROVIDER_CLI_COMMAND.REPOSITORY, PROVIDER_CLI_COMMAND.VIEW, PROVIDER_CLI_OPTION.JSON, GITHUB_ISSUE_QUERY.REPOSITORY_NAME_FIELD]);
          throw new ProviderIssueLookupError({
            code: PROVIDER_ISSUE_LOOKUP_ERROR.ISSUE_NOT_FOUND,
            provider: ISSUE_PROVIDER.GITHUB,
            retryable: false,
            status: 404,
            message: `GitHub issue #${issueId} does not exist while repository access remains valid.`,
            cause: error,
          });
        } catch (accessError) {
          if (accessError instanceof ProviderIssueLookupError) throw accessError;
          throw classifyProviderProjectAccessFailure(ISSUE_PROVIDER.GITHUB, accessError);
        }
      }

      throw classifyProviderLookupFailure(ISSUE_PROVIDER.GITHUB, error);
    }
  }

  /** Read all issue conversation pages before building worker context.
   * @param issueId - Provider issue whose complete discussion is requested.
   */
  async listComments(issueId: number): Promise<IssueComment[]> {
    const comments = await this.transport.collection(githubApiPath(GITHUB_API_RESOURCE.ISSUES, issueId, GITHUB_API_RESOURCE.COMMENTS), GhCommentSchema);

    return comments.map(comment => ({ id: comment.id, author: comment.user.login, body: comment.body, created_at: comment.created_at }));
  }

  /** Apply an explicitly selected closed state idempotently.
   * @param issueId - Provider-local issue identity within the configured repository.
   */
  async closeIssue(issueId: number): Promise<void> { await this.transport.write([PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.CLOSE, String(issueId)]); }

  /** Apply an explicitly selected open state idempotently.
   * @param issueId - Provider-local issue identity within the configured repository.
   */
  async reopenIssue(issueId: number): Promise<void> { await this.transport.write([PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.REOPEN, String(issueId)]); }

  /** Declare whether the concrete adapter supports explicit issue deletion.
   */
  supportsIssueDeletion(): boolean { return true; }

  /** Delete once; abnormal completion never proves successful deletion.
   * @param issueId - Provider identity explicitly selected for deletion.
   */
  async deleteIssue(issueId: number): Promise<void> {
    await this.transport.once([PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.DELETE, String(issueId), PROVIDER_CLI_OPTION.CONFIRM]);
  }

  /** Create one comment without replaying a mutation whose response may have been lost.
   * @param issueId - Provider issue receiving the comment.
   * @param body - Complete comment text submitted once.
   */
  async addComment(issueId: number, body: string): Promise<number> {
    let raw: string;

    try {
      raw = await this.transport.once([
        PROVIDER_CLI_COMMAND.API, githubApiPath(GITHUB_API_RESOURCE.ISSUES, issueId, GITHUB_API_RESOURCE.COMMENTS),
        PROVIDER_CLI_OPTION.METHOD, PROVIDER_HTTP_METHOD.POST, PROVIDER_CLI_OPTION.FIELD, `${GITHUB_API_FIELD.BODY}=${body}`,
      ]);
    } catch (error) {
      throw classifyProviderOperationError(error);
    }

    try {
      const response: unknown = JSON.parse(raw);

      return ProviderResourceIdentitySchema.parse(response).id;
    } catch (error) {
      throw new ProviderOperationError({ code: PROVIDER_OPERATION_ERROR.UNKNOWN,
        message: "GitHub comment creation returned no confirmed comment identity.",
        retryable: false, outcomeUnknown: true, cause: error });
    }
  }

  /** Apply explicit title/body edits and return the subsequent validated issue observation.
   * @param issueId - Provider-local issue identity within the configured repository.
   * @param updates - Explicit title and body fields selected for provider mutation.
   */
  async editIssue(issueId: number, updates: IssueEditInput): Promise<Issue> {
    const args = [PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.EDIT, String(issueId)];

    if (updates.title !== undefined) args.push(PROVIDER_CLI_OPTION.TITLE, updates.title);
    if (updates.body !== undefined) args.push(PROVIDER_CLI_OPTION.BODY, updates.body);
    await this.transport.write(args);

    return this.getIssue(issueId);
  }
}
