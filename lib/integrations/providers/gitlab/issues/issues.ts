/** Owns GitLab issues operations and their provider-specific API semantics. */

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
import { PROVIDER_CLI_COMMAND, PROVIDER_CLI_OPTION, PROVIDER_HTTP_METHOD, PROVIDER_JSON_OUTPUT_FORMAT,ProviderResourceIdentitySchema } from "../../transport/index.js";
import { GITLAB_API_FIELD,GITLAB_API_QUERY, GITLAB_API_RESOURCE, GITLAB_REQUEST_STATE, gitlabApiPath } from "../api/index.js";
import { GitLabNoteSchema } from "../comments/index.js";
import { GITLAB_CREATED_ISSUE_URL_PATTERN } from "./const.js";
import { GitLabIssueSchema } from "./schema.js";

/** Implements the issues capability using dependencies shared by one adapter instance. */
export class GitLabIssues {
  /** Bind the concrete capability to its owning adapter.
   * @param transport - Instance-owned checked command transport.
   */
  constructor(private readonly transport: ProviderTransport) {}

  /** Submit one issue creation; an unidentified or lost response never authorizes replay.
   * @param input - Complete application-selected issue payload for one creation attempt.
   */
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    try {
      // Pass description directly as argv — runCommand uses spawn (no shell),
      // so no escaping issues with special characters.
      const args = [PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.CREATE, PROVIDER_CLI_OPTION.TITLE, input.title, PROVIDER_CLI_OPTION.DESCRIPTION, input.body];

      if (input.labels.length) args.push(PROVIDER_CLI_OPTION.LABEL, input.labels.join(","));
      if (input.assignees.length) args.push(PROVIDER_CLI_OPTION.ASSIGNEE, input.assignees.join(","));
      const stdout = await this.transport.once(args);
      // glab issue create returns the issue URL
      const match = stdout.match(GITLAB_CREATED_ISSUE_URL_PATTERN);

      if (!match || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0) {
        throw new ProviderOperationError({ code: PROVIDER_OPERATION_ERROR.UNKNOWN, message: "Issue creation returned no confirmed identity.",
          retryable: false, outcomeUnknown: true });
      }

      return {
        iid: parseInt(match[1], 10),
        title: input.title,
        description: input.body,
        labels: [...input.labels],
        state: GITLAB_REQUEST_STATE.OPEN,
        web_url: match[0],
      };
    } catch (error) {
      throw classifyProviderOperationError(error);
    }
  }

  /** Read all open issue pages carrying the requested label.
   * @param label - Provider-visible issue label.
   */
  async listIssuesByLabel(label: StateLabel): Promise<Issue[]> {
    return this.listIssues({ label, state: PROVIDER_COLLECTION_STATE.OPEN });
  }

  /** Read complete issue collections, preserving provider-side filter semantics.
   * @param opts - Optional label and issue lifecycle filters.
   */
  async listIssues(opts?: IssueListFilter): Promise<Issue[]> {
    const state = opts?.state === PROVIDER_COLLECTION_STATE.OPEN || opts?.state === undefined ? GITLAB_REQUEST_STATE.OPEN : opts.state;
    const label = opts?.label ? `&${GITLAB_API_QUERY.LABELS}=${encodeURIComponent(opts.label)}` : "";

    return this.transport.collection(`${gitlabApiPath(GITLAB_API_RESOURCE.ISSUES)}?${GITLAB_API_QUERY.STATE}=${state}${label}`, GitLabIssueSchema);
  }

  /** Read a validated issue, distinguishing missing identity from failed repository access.
   * @param issueId - Provider-local issue identity within the configured repository.
   */
  async getIssue(issueId: number): Promise<Issue> {
    try {
      const raw = await this.transport.read([PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.VIEW, String(issueId), PROVIDER_CLI_OPTION.OUTPUT, PROVIDER_JSON_OUTPUT_FORMAT]);
      const parsed: unknown = JSON.parse(raw);

      const issue = GitLabIssueSchema.parse(parsed);

      if (issue.iid !== issueId) throw new ProviderIssueLookupError({ code: PROVIDER_ISSUE_LOOKUP_ERROR.UNKNOWN,
        provider: ISSUE_PROVIDER.GITLAB, retryable: false, message: "Provider returned another issue identity for the selected lookup." });

      return issue;
    } catch (error) {
      if (error instanceof ProviderIssueLookupError) throw error;
      if (mayBeMissingProviderIssue(error)) {
        try {
          await this.transport.read([PROVIDER_CLI_COMMAND.REPOSITORY, PROVIDER_CLI_COMMAND.VIEW, PROVIDER_CLI_OPTION.OUTPUT, PROVIDER_JSON_OUTPUT_FORMAT]);
          throw new ProviderIssueLookupError({
            code: PROVIDER_ISSUE_LOOKUP_ERROR.ISSUE_NOT_FOUND,
            provider: ISSUE_PROVIDER.GITLAB,
            retryable: false,
            status: 404,
            message: `GitLab issue #${issueId} does not exist while project access remains valid.`,
            cause: error,
          });
        } catch (accessError) {
          if (accessError instanceof ProviderIssueLookupError) throw accessError;
          throw classifyProviderProjectAccessFailure(ISSUE_PROVIDER.GITLAB, accessError);
        }
      }

      throw classifyProviderLookupFailure(ISSUE_PROVIDER.GITLAB, error);
    }
  }

  /** Read all non-system issue notes before constructing worker discussion.
   * @param issueId - Provider issue whose discussion is requested.
   */
  async listComments(issueId: number): Promise<IssueComment[]> {
    const notes = await this.transport.collection(gitlabApiPath(GITLAB_API_RESOURCE.ISSUES, issueId, GITLAB_API_RESOURCE.NOTES), GitLabNoteSchema);

    return notes.filter(note => !note.system).map(note => ({ id: note.id, author: note.author.username, body: note.body, created_at: note.created_at }));
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
    await this.transport.once([PROVIDER_CLI_COMMAND.API, gitlabApiPath(GITLAB_API_RESOURCE.ISSUES, issueId), PROVIDER_CLI_OPTION.METHOD, PROVIDER_HTTP_METHOD.DELETE]);
  }

  /** Create one note without replaying a mutation whose response may have been lost.
   * @param issueId - Provider issue receiving the note.
   * @param body - Complete note text submitted once.
   */
  async addComment(issueId: number, body: string): Promise<number> {
    let raw: string;

    try {
      raw = await this.transport.once([
        PROVIDER_CLI_COMMAND.API, gitlabApiPath(GITLAB_API_RESOURCE.ISSUES, issueId, GITLAB_API_RESOURCE.NOTES),
        PROVIDER_CLI_OPTION.METHOD, PROVIDER_HTTP_METHOD.POST, PROVIDER_CLI_OPTION.FIELD, `${GITLAB_API_FIELD.BODY}=${body}`,
      ]);
    } catch (error) {
      throw classifyProviderOperationError(error);
    }

    try {
      const response: unknown = JSON.parse(raw);

      return ProviderResourceIdentitySchema.parse(response).id;
    } catch (error) {
      throw new ProviderOperationError({ code: PROVIDER_OPERATION_ERROR.UNKNOWN,
        message: "GitLab note creation returned no confirmed comment identity.",
        retryable: false, outcomeUnknown: true, cause: error });
    }
  }

  /** Apply explicit title/body edits and return the subsequent validated issue observation.
   * @param issueId - Provider-local issue identity within the configured repository.
   * @param updates - Explicit title and body fields selected for provider mutation.
   */
  async editIssue(issueId: number, updates: IssueEditInput): Promise<Issue> {
    const args = [PROVIDER_CLI_COMMAND.ISSUE, PROVIDER_CLI_COMMAND.UPDATE, String(issueId)];

    if (updates.title !== undefined) args.push(PROVIDER_CLI_OPTION.TITLE, updates.title);
    if (updates.body !== undefined) args.push(PROVIDER_CLI_OPTION.DESCRIPTION, updates.body);
    await this.transport.write(args);

    return this.getIssue(issueId);
  }
}
