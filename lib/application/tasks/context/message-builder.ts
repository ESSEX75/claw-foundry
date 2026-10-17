/**
 * message-builder.ts — Task message construction for worker sessions.
 */

import { formatPrContext, formatPrFeedback, PR_FEEDBACK_REASON } from "../../review/index.js";
import type { BuildConflictFixMessageInput, BuildTaskMessageInput } from "./types.js";

/**
 * Build the task message sent to a worker session.
 *
 * Role-specific instructions are NOT included in the message body.
 * They are passed as `extraSystemPrompt` in the gateway agent call,
 * which injects them into the worker's system prompt (see dispatch flow).
 *
 * @param opts - Resolved project dependencies and operation-specific input.
 */
export function buildTaskMessage(opts: BuildTaskMessageInput): string {
  const {
    projectName, channelId, role, issueId, issueTitle,
    issueDescription, issueUrl, repo, baseBranch,
  } = opts;

  const results = Object.keys(opts.resolvedRole?.completion ?? {});
  const availableResults = results.map((result) => `"${result}"`).join(", ");

  const isFeedbackCycle = !!opts.prFeedback;

  const parts = [
    `${role.toUpperCase()} task for project "${projectName}" — Issue #${issueId}`,
    ``,
    issueTitle,
    issueDescription ? `\n${issueDescription}` : "",
  ];

  if (isFeedbackCycle) {
    parts.push(
      ``,
      `> **⚠️ FEEDBACK CYCLE — This issue is returning from review.**`,
      `> The original description above is for context only.`,
      `> Your job is to address the PR Review Feedback and Comments below.`,
      `> When feedback conflicts with the original description, follow the feedback.`,
    );
  }

  // Include comments if present
  if (opts.comments && opts.comments.length > 0) {
    parts.push(``, `## Comments`);
    for (const comment of opts.comments) {
      const date = new Date(comment.created_at).toLocaleString();

      parts.push(``, `**${comment.author}** (${date}):`, comment.body);
    }
  }

  if (opts.discussionNotice) parts.push(``, opts.discussionNotice);

  if (opts.prContext) parts.push(...formatPrContext(opts.prContext));
  if (opts.prFeedback) {
    parts.push(...formatPrFeedback(opts.prFeedback, baseBranch));

    // Defensive warning if branch name is missing (shouldn't happen in practice)
    if (!opts.prFeedback.branchName && opts.prFeedback.reason === PR_FEEDBACK_REASON.MERGE_CONFLICT) {
      parts.push(
        ``,
        `⚠️ **Branch name could not be determined automatically.**`,
        `Check the PR URL above to find the correct branch, then:`,
        `\`\`\`bash`,
        `gh pr view <PR-number> --json headRefName --jq .headRefName`,
        `\`\`\``,
      );
    }
  }

  if (opts.attachmentContext) parts.push(opts.attachmentContext);

  parts.push(
    ``,
    `Repo: ${repo} | Branch: ${baseBranch} | ${issueUrl}`,
    `Project: ${projectName} | Channel: ${channelId}`,
  );

  parts.push(
    ``, `---`, ``,
    `## MANDATORY: Task Completion`,
    ``,
    `When you finish this task, you MUST call \`work_finish\` with:`,
    `- \`role\`: "${role}"`,
    `- \`channelId\`: "${channelId}"`,
    `- \`result\`: ${availableResults}`,
    `- \`summary\`: brief description of what you did`,
    ``,
    `⚠️ You MUST call work_finish even if you encounter errors or cannot finish.`,
    `Use "blocked" with a summary explaining why you're stuck.`,
    `Never end your session without calling work_finish.`,
  );

  return parts.join("\n");
}

/**
 * Build a minimal conflict-fix message — no issue description, no comments.
 * Just the PR feedback (rebase instructions) and work_finish instructions.
 *
 * @param opts - Resolved project dependencies and operation-specific input.
 */
export function buildConflictFixMessage(opts: BuildConflictFixMessageInput): string {
  const {
    projectName, channelId, role, issueId,
    issueUrl, repo, baseBranch, prFeedback,
  } = opts;

  const results = Object.keys(opts.resolvedRole?.completion ?? {});
  const availableResults = results.map((result) => `"${result}"`).join(", ");

  const parts = [
    `${role.toUpperCase()} task for project "${projectName}" — Issue #${issueId}`,
    ``,
    `> **🔧 MERGE CONFLICT FIX — This is a focused conflict resolution task.**`,
    `> Rebase the PR branch onto \`${baseBranch}\`, resolve conflicts, and force-push.`,
    `> Do NOT re-implement the feature or make other changes.`,
  ];

  parts.push(...formatPrFeedback(prFeedback, baseBranch));

  parts.push(
    ``,
    `Repo: ${repo} | Branch: ${baseBranch} | ${issueUrl}`,
    `Project: ${projectName} | Channel: ${channelId}`,
  );

  parts.push(
    ``, `---`, ``,
    `## MANDATORY: Task Completion`,
    ``,
    `When you finish this task, you MUST call \`work_finish\` with:`,
    `- \`role\`: "${role}"`,
    `- \`channelId\`: "${channelId}"`,
    `- \`result\`: ${availableResults}`,
    `- \`summary\`: brief description of what you did`,
    ``,
    `⚠️ You MUST call work_finish even if you encounter errors or cannot finish.`,
    `Use "blocked" with a summary explaining why you're stuck.`,
    `Never end your session without calling work_finish.`,
  );

  return parts.join("\n");
}
