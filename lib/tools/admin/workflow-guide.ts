/**
 * workflow_guide — Reference tool for editing workflow.yaml.
 *
 * Returns a comprehensive guide explaining the workflow config structure,
 * all enums/constrained values, the three-layer config system, and
 * common customization recipes. Designed to be read by an LLM before
 * it edits any workflow.yaml file.
 *
 * Optional topic selection, no side effects — pure documentation.
 */

import { jsonResult, type OpenClawPluginToolContext, type OpenClawPluginToolFactory } from "openclaw/plugin-sdk/core";
import { z } from "zod";

import { DATA_DIR } from "../../state/index.js";
import { requireWorkspaceDir } from "../helpers.js";
import { toolInputParameters } from "../validation/index.js";

type WorkflowGuideTopic =
  | "overview"
  | "states"
  | "roles"
  | "review"
  | "testing"
  | "timeouts"
  | "overrides";

const WORKFLOW_GUIDE_TOPICS: readonly WorkflowGuideTopic[] = [
  "overview",
  "states",
  "roles",
  "review",
  "testing",
  "timeouts",
  "overrides",
];

/** Validates workflow-guide arguments before context resolution or effects. */
const workflowGuideInput = z.strictObject({
  topic: z.enum(WORKFLOW_GUIDE_TOPICS).describe("Optional: narrow to a specific topic. " +
    'Options: "overview", "states", "roles", "review", "testing", "timeouts", "overrides". ' +
    "Omit for the full guide.").optional(),
});

/** Create the workflow guide SDK adapter with validated command input. */
export function createWorkflowGuideTool(): OpenClawPluginToolFactory {
  return (toolCtx: OpenClawPluginToolContext) => ({
    name: "workflow_guide",
    label: "Workflow Guide",
    description:
      `Reference guide for editing workflow.yaml. ` +
      `Call this BEFORE making any workflow configuration changes. ` +
      `Returns the full config structure, all valid values (enums, free-form fields), ` +
      `the three-layer override system, and common recipes like enabling the test phase ` +
      `or changing the review policy.`,
    parameters: toolInputParameters(workflowGuideInput),

    /** Parse the untrusted request before resolving context or performing effects.
     * @param _id - SDK invocation identity used by commands requiring correlation.
     * @param rawParams - Untrusted tool arguments.
     */
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const params = workflowGuideInput.parse(rawParams);
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const dataDir = `${workspaceDir}/${DATA_DIR}`;
      const topic = params.topic;

      const sections: Record<WorkflowGuideTopic, string> = {
        overview: buildOverview(dataDir),
        states: buildStatesSection(),
        roles: buildRolesSection(),
        review: buildReviewSection(),
        testing: buildTestingSection(),
        timeouts: buildTimeoutsSection(),
        overrides: buildOverridesSection(dataDir),
      };

      if (topic !== undefined) {
        return jsonResult({ guide: sections[topic] });
      }

      // Full guide
      const full = Object.values(sections).join("\n\n---\n\n");

      return jsonResult({ guide: full });
    },
  });
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/** Explain config layering and retained local policy snapshots.
 * @param dataDir - Resolved workspace data root displayed in file locations.
 */
function buildOverview(dataDir: string): string {
  return `# Workflow Configuration Guide

## File structure

The config file is \`workflow.yaml\`. It has three top-level keys:

\`\`\`yaml
roles:      # Structured role level configuration
workflow:   # State machine definition
timeouts:   # Optional timeout overrides
\`\`\`

## Three-layer config system

Config is resolved by merging three layers (later layers override earlier):

1. **Built-in defaults** — hardcoded in the plugin, always present
2. **Workspace config** — \`${dataDir}/workflow.yaml\` — shared across all projects
3. **Project config** — \`${dataDir}/projects/<name>/workflow.yaml\` — per-project overrides

### Merge semantics
- **Objects**: deep merge (sparse override — only specify what you change, including completion mappings)
- **Primitives**: override
- **\`false\` for a role**: disables it entirely
- **\`false\` for a level**: removes that inherited level

A project config only needs the keys it wants to override. Example project override:
\`\`\`yaml
roles:
  developer:
    levels:
      senior:
        model: anthropic/claude-opus-4-6
workflow:
  reviewPolicy: agent
\`\`\`
This changes only the senior developer model and the default review policy for new issues; everything else inherits.
Existing managed issues retain their local policy snapshots until explicitly migrated with \`issue_policy_migrate\`.`;
}

/** Explain configured workflow states and definition-only label synchronization. */
function buildStatesSection(): string {
  return `# Workflow States

## State types (FIXED — 4 values, cannot add new types)

| Type       | Meaning                                        |
|------------|------------------------------------------------|
| \`queue\`    | Waiting for pickup. Must have a \`role\`. Has \`priority\` (higher = picked first). |
| \`active\`   | Work in progress. Must have a \`role\`.          |
| \`hold\`     | Paused, waiting for human input. No role needed. |
| \`terminal\` | End state. No outgoing transitions allowed.     |

## State config fields

| Field        | Type     | Required | Constrained? | Notes |
|-------------|----------|----------|--------------|-------|
| \`type\`      | string   | yes      | FIXED enum: \`queue\`, \`active\`, \`hold\`, \`terminal\` | |
| \`role\`      | string   | for queue/active | Must match a role key from \`roles:\` section | e.g. \`developer\`, \`reviewer\`, \`tester\` |
| \`label\`     | string   | yes      | FREE — any text | Becomes a GitHub/GitLab label. Must be unique across states. |
| \`color\`     | string   | yes      | FREE — any hex color | Format: \`"#rrggbb"\`. Used for the issue label color. |
| \`priority\`  | number   | no       | FREE — any integer | Higher values are picked first. Only meaningful on \`queue\` states. |
| \`description\`| string  | no       | FREE — any text | Optional description for documentation. |
| \`check\`     | string   | no       | FIXED enum: \`prApproved\`, \`prMerged\` | Triggers PR status check during heartbeat. |
| \`on\`        | object   | no       | Keys are events (see below), values are transitions | |

## State names (the YAML keys)
**EXTENSIBLE** — you choose the key names. They must:
- Unique within the workflow
- Start with a letter and contain only letters, numbers, underscores, or hyphens
- Referenced consistently in transition targets

Examples: \`planning\`, \`todo\`, \`doing\`, \`toReview\`, \`reviewing\`, \`done\`, \`toImprove\`, \`refining\`

## Workflow events (FIXED — cannot add new events)

These are the valid keys for the \`on:\` object on a state:

| Event              | Meaning                                    | Typical source |
|--------------------|--------------------------------------------|----------------|
| \`PICKUP\`           | Worker picks up from queue                 | Queue dispatch  |
| \`COMPLETE\`         | Worker finished successfully               | Worker tool     |
| \`REVIEW\`           | Send a task for review in a configured transition | Role completion mapping |
| \`APPROVE\`          | Human/agent approves                       | Reviewer tool   |
| \`REJECT\`           | Reviewer rejects                           | Reviewer tool   |
| \`APPROVED\`         | PR approved on GitHub/GitLab               | Heartbeat       |
| \`CHANGES_REQUESTED\`| PR has change requests or unprocessed comments | Heartbeat   |
| \`MERGE_FAILED\`     | PR merge attempt failed                    | Heartbeat       |
| \`MERGE_CONFLICT\`   | PR has merge conflicts                     | Heartbeat       |
| \`PASS\`             | Tester passes                              | Tester tool     |
| \`FAIL\`             | Tester fails                               | Tester tool     |
| \`REFINE\`           | Needs refinement                           | Tester tool     |
| \`SKIP\`             | Follow a configured skipped-policy transition | Heartbeat |
| \`PR_CLOSED\`        | Linked PR closed without merge | Heartbeat |
| \`BLOCKED\`          | Work is blocked                            | Any worker tool |

## Transition target format

Every transition uses an object with a required \`target\`. Optional \`actions\`
and \`description\` fields may be added without changing the transition shape:
\`\`\`yaml
APPROVED:
  target: done
  actions:
    - mergePr
    - gitPull
    - closeIssue
\`\`\`

## Built-in actions (FIXED set — unknown values are rejected)

| Action         | What it does                              |
|----------------|-------------------------------------------|
| \`detectPr\`     | Detect if a PR/MR exists for the issue    |
| \`mergePr\`      | Merge the associated PR/MR                |
| \`gitPull\`      | Pull latest changes on the project repo   |
| \`closeIssue\`   | Close the issue on GitHub/GitLab          |
| \`reopenIssue\`  | Reopen the issue on GitHub/GitLab         |

## Validation rules (enforced at load time)

- \`initial\` state must exist in \`states\`
- \`queue\` and \`active\` states must have a \`role\`
- \`terminal\` states must NOT have \`on\` transitions
- All transition targets must point to existing state keys
- State labels must be unique
- State labels have a maximum length of 50 characters
- State labels must not use \`owner:\`, \`notify:\`, or \`role:level\` routing formats

## Syncing labels after changes

After adding, renaming, or removing states in workflow.yaml, run the \`sync_labels\` tool to create the ` +
    `corresponding label definitions on GitHub/GitLab. Registration also provisions them; ` +
    `workflow.yaml edits are not automatically synced.

\`sync_labels\` reads the fully resolved config (built-in + workspace + project overrides) and ensures ` +
    `every state label, role:level label, and step routing label exists on the provider. It is idempotent — ` +
    `safe to run multiple times.

This only provisions repository label definitions: it does not migrate local issue state,
rename stored workflow states, delete old definitions, or reconcile individual issue projections.

\`\`\`
sync_labels                         # sync all projects
sync_labels projectSlug=my-project  # sync one project
\`\`\`

Arguments for syncing one project:
\`\`\`json
{"projectSlug":"my-project"}
\`\`\``;
}

/** Explain role configuration, workflow reachability and instruction ownership. */
function buildRolesSection(): string {
  return `# Roles Configuration

## Built-in roles (4 defaults — can override or disable)

| Role       | Default levels          | Default level | Completion results         |
|-----------|------------------------|---------------|----------------------------|
| \`developer\`| junior, medior, senior | medior        | done, blocked              |
| \`tester\`   | junior, medior, senior | medior        | pass, fail, refine, blocked|
| \`architect\` | junior, senior         | junior        | done, blocked              |
| \`reviewer\`  | junior, senior         | junior        | approve, reject, blocked   |

## Role config fields

| Field              | Constrained?  | Notes |
|-------------------|---------------|-------|
| \`levels\`          | FREE — map of level ID→definition | Each definition owns rank, model, optional maxWorkers, and optional emoji. Use false to remove an inherited level. |
| \`defaultLevel\`    | Must be one of \`levels\` | Used when no level specified on issue. |
| \`completion\` | Result-to-event mapping | Maps worker results to explicit events; each event needs a transition in the role's active states. |

## Default model assignments

| Level    | Default model                    |
|---------|----------------------------------|
| junior   | \`anthropic/claude-haiku-4-5\`    |
| medior   | \`anthropic/claude-sonnet-4-5\`   |
| senior   | \`anthropic/claude-opus-4-6\`     |

Architect junior defaults to \`anthropic/claude-sonnet-4-5\`.
Reviewer senior defaults to \`anthropic/claude-sonnet-4-5\`.

## Disabling a role

Set the role to \`false\`:
\`\`\`yaml
roles:
  tester: false
\`\`\`

## Adding a custom role

Define the role with all required fields. The role key must also be referenced as a \`role:\` in at least one workflow state.
\`\`\`yaml
roles:
  security_auditor:
    levels:
      standard:
        rank: 1
        model: anthropic/claude-sonnet-4-5
      expert:
        rank: 2
        model: anthropic/claude-opus-4-6
    defaultLevel: standard
    completion:
      done: COMPLETE
      blocked: BLOCKED
\`\`\`
Then add states that use \`role: security_auditor\`.

Declaring the role is not enough: place it in the workflow graph.

1. An earlier state's transition must target the custom role's queue state.
2. That queue state must use \`role: security_auditor\` and route \`PICKUP\` to
   an active state for the same role.
3. The active state's completion events must target the states that run next.

Example order:
\`architect active state -> security_auditor queue -> security_auditor active state -> developer queue\`.

Without an incoming transition the role is unreachable. Without an outgoing
transition the workflow stops after the role finishes.

## Prompts per role

Each role can have a system prompt file:
- Workspace default: \`<dataDir>/prompts/<role>.md\`
- Project override: \`<dataDir>/projects/<name>/prompts/<role>.md\`

If neither prompt exists, DevClaw supplies no role-specific instructions and does not
substitute orchestrator instructions. Do not assume a generic role prompt. Create the
role prompt before enabling or dispatching it.`;
}

/** Explain authoritative policy snapshots and explicit migration before projection. */
function buildReviewSection(): string {
  return `# Review Policy

## reviewPolicy (FIXED — 3 values)

Set defaults for new issues in \`workflow.reviewPolicy\`; existing issues retain local snapshots:

| Value    | Behavior |
|---------|----------|
| \`human\` | **(default)** All PRs wait for human approval on GitHub/GitLab. The heartbeat polls PR status and auto-merges when approved. |
| \`agent\` | Every PR is reviewed by an agent (reviewer role) before merge. Agent can approve or reject. |
| \`skip\`  | Skip the review worker; configured workflow transitions continue automatically. |

## How review routing works

1. Developer finishes work → issue moves to \`toReview\` state
2. Heartbeat checks \`reviewPolicy\` to decide routing:
   - \`human\`: issue stays in \`toReview\`, heartbeat polls PR for approval
   - \`agent\`: heartbeat dispatches a reviewer worker to check the PR
   - \`skip\`: skips the reviewer worker and follows the configured transition
3. The \`toReview\` state should have a \`check: prApproved\` field for human review flow

## Per-issue policy snapshots and their label projection

For each initialized issue, \`devclaw/projects/<project>/issues.json\` is authoritative.
Its \`reviewPolicy\` and \`testPolicy\` snapshots determine routing; provider labels and
body metadata display local state. Manual label/body edits never change runtime policy.

| Projected label | Local snapshot |
|----------------|----------------|
| \`review:human\` | \`reviewPolicy: human\` |
| \`review:agent\` | \`reviewPolicy: agent\` |
| \`review:skip\` | \`reviewPolicy: skip\` |
| \`test:skip\` | \`testPolicy: skip\` |

Use \`issue_policy_migrate\` to change an existing issue's snapshots through the
application command, first previewing the exact selection:
\`\`\`json
{"project":"my-project","issueIds":[42],"reviewPolicy":"agent","dryRun":true}
\`\`\`
After reviewing the preview, apply the same selection explicitly:
\`\`\`json
{"project":"my-project","issueIds":[42],"reviewPolicy":"agent","dryRun":false}
\`\`\`
Active worker reservations are skipped; terminal issues are excluded unless explicitly
selected with \`includeClosed: true\`. Apply writes local policy before reconciling
labels. If projection fails, the local policy remains committed; repeat the same
command to resume label reconciliation. Missing local records are never initialized
from provider labels by policy migration. Inspect both changed and skipped results.

## Example: switching to agent review

\`\`\`yaml
workflow:
  reviewPolicy: agent
\`\`\`

The reviewer role must be configured (it is by default) and needs a prompt file at \`<dataDir>/prompts/reviewer.md\`.`;
}

/** Explain configured testing defaults and explicit migration of existing issue snapshots. */
function buildTestingSection(): string {
  return `# Test Phase (Optional)

Testing is skipped by default through \`workflow.testPolicy: skip\`.
The built-in graph already contains \`toTest\` and \`testing\`; review transitions
merge the PR and enter \`toTest\`, whose \`SKIP\` transition closes the issue.

## Enable testing for new issues

\`\`\`yaml
workflow:
  testPolicy: agent
\`\`\`

Keep the tester role enabled and provide \`<dataDir>/prompts/tester.md\` or a
project override at \`<dataDir>/projects/<project-slug>/prompts/tester.md\`.
For a custom graph, ensure review transitions reach the tester queue, its \`PICKUP\`
reaches the tester active state, and \`PASS\`, \`FAIL\`, \`REFINE\` and \`BLOCKED\`
route explicitly. A test queue needs a \`SKIP\` transition for skipped snapshots.
Run \`sync_labels\` after changing label definitions; it does not change issue policies.

## Existing issues and per-issue skip

Changing workflow defaults does not replace policy snapshots of initialized issues.
Use \`issue_policy_migrate\` to preview enabling testing for selected existing issues:
\`\`\`json
{"project":"my-project","issueIds":[42],"testPolicy":"agent","dryRun":true}
\`\`\`
Apply the same selection with \`dryRun: false\` after reviewing the result.
To skip testing on one existing issue, preview then apply \`testPolicy: skip\`:
\`\`\`json
{"project":"my-project","issueIds":[42],"testPolicy":"skip","dryRun":true}
\`\`\`
The command updates local \`issues.json\` first and projects labels from it.
Adding or removing \`test:skip\` on the provider never changes the local snapshot.

With agent testing: Planning -> To Do -> Doing -> To Review -> To Test -> Testing -> Done.
With skipped testing: To Test -> SKIP -> Done, without dispatching a tester.`;
}

/** Describe supported timeout configuration for operators. */
function buildTimeoutsSection(): string {
  return `# Timeouts

All timeout values are optional. Specify only the ones you want to override.

\`\`\`yaml
timeouts:
  gitPullMs: 30000          # Git pull timeout (default: 30s)
  gatewayMs: 15000          # Gateway API timeout (default: 15s)
  sessionPatchMs: 30000     # Session patch timeout (default: 30s)
  dispatchMs: 600000        # Worker dispatch timeout (default: 10min)
  staleWorkerHours: 2       # Hours before a worker is considered stale (default: 2)
  sessionContextBudget: 0.6 # Clear session when context exceeds 60% of limit (default: 0.6)
\`\`\`

| Field             | Type   | Default  | Notes |
|-------------------|--------|----------|-------|
| \`gitPullMs\`       | number | 30000    | Must be positive. Milliseconds. |
| \`gatewayMs\`       | number | 15000    | Must be positive. Milliseconds. |
| \`sessionPatchMs\`  | number | 30000    | Must be positive. Milliseconds. |
| \`dispatchMs\`      | number | 600000   | Must be positive. Milliseconds. How long a worker dispatch can take. |
| \`staleWorkerHours\`| number | 2        | Must be positive. Hours. After this, worker is flagged as stale. |
| \`sessionContextBudget\` | number | 0.6 | 0-1. Clear session when context exceeds this ratio. Set to 1.0 to disable. Skips clear on same-issue re-dispatch (feedback cycle). |`;
}

/** Show project configuration and prompt override ownership.
 * @param dataDir - Workspace data root displayed in project file locations.
 */
function buildOverridesSection(dataDir: string): string {
  return `# Project-Level Overrides

## File location
\`${dataDir}/projects/<project-name>/workflow.yaml\`

## What can be overridden per project
Everything. A project workflow.yaml has the same structure as the workspace one. Only specify what differs.

## Common override patterns

### Different review policy for one project
\`\`\`yaml
workflow:
  reviewPolicy: skip
\`\`\`

### Upgrade models for a critical project
\`\`\`yaml
roles:
  developer:
    levels:
      medior:
        model: anthropic/claude-opus-4-6
\`\`\`

### Disable tester for one project
\`\`\`yaml
roles:
  tester: false
\`\`\`

### Use different model provider
\`\`\`yaml
roles:
  developer:
    levels:
      junior: { model: google/gemini-2.0-flash }
      medior: { model: google/gemini-2.5-pro }
      senior: { model: anthropic/claude-opus-4-6 }
\`\`\`

### Allow concurrent developers on a project
\`\`\`yaml
roles:
  developer:
    levels:
      medior:
        model: anthropic/claude-sonnet-4-5
        maxWorkers: 3  # Allow up to 3 medior developers in parallel
\`\`\`

### Override timeouts for a slow repo
\`\`\`yaml
timeouts:
  gitPullMs: 60000
  dispatchMs: 900000
\`\`\`

## Prompt overrides
Place role-specific prompts in:
\`${dataDir}/projects/<project-name>/prompts/<role>.md\`

These completely replace (not merge with) the workspace-level prompts for that role.`;
}
