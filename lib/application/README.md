# Application

Owns use cases coordinating domain decisions, state persistence, and integrations.
Adapters outside this layer use the root `index.ts`. Within application, use sibling
capability entrypoints; never import the root or a capability's own barrel internally.

| Subsystem | Ownership and capabilities |
| --- | --- |
| `workspace` | Environment administration: `setup`, `configuration`, `agents`, `bindings`, `permissions`, `onboarding`. |
| `projects` | Registered project management: `registration`, `channels`, `routing`, `context`, `labels`. |
| `issues` | Managed issue lifecycle: `commands`, `queries`, `runtime`, `attachments`, `projection`, `maintenance`. |
| `execution` | Pipeline execution: `heartbeat`, `scheduling`, `workers`, `workflow`, `context`, `feedback`. |
| `notifications` | Exact endpoint delivery, terminal retries, rendering and delivery audit. |
| `diagnostics` | Read-only workspace, route, tool-isolation and archive diagnostics. |

The root API aggregates these six subsystem APIs. Projects, issues and execution
aggregate their supported capability APIs. Workspace is a facade selecting supported
administrative operations; it hides agent, binding, permission and configuration
composition helpers. Setup coordinates target planning and ordered apply; ongoing
configuration comparison/reset, model resolution and plugin writes belong to
workspace/configuration. SDK bindings and agent permissions are workspace-wide;
registered project endpoints and their authorization belong to projects.

These groups organize related capabilities without creating new runtime dependency
cycles. Application-internal consumers use the target capability's entrypoint,
including across subsystem groups, rather than the group aggregate. For example,
research calls execution/workers, heartbeat resumes issues/commands creation, and
diagnostics calls workspace/permissions. Descendants never import their own or an
ancestor barrel. Outside application, callers use only application/index.ts.
Existing nested capability APIs remain the boundary for siblings; configuration may
read execution/heartbeat/configuration directly without loading service registration.

Workspace root types/const contain the shared setup inputs, runtime ports, operation
and recovery contracts used by its capabilities. Its type-only composition can read
binding and permission types directly. Projects root types/const hold common project,
endpoint, command-result and audit contracts. Root selection.ts is internal shared
endpoint matching/name allocation for registration, channels and context; public
project selection belongs to context. Notifications stays flat as one delivery
capability; diagnostics stays flat as one read-only report capability. No nested
README files or compatibility entrypoints are supported.

Each capability exposes its supported API through `index.ts`. Storage uses
`lib/state/index.ts`; provider/session effects use integration APIs. Pure projection
belongs to `lib/projection`. CLI parsing and tool-response formatting stay in adapters.
Local issue state is authoritative; provider-state import requires explicit
initialization or repair. Run `npm run arch:check:strict` after boundary changes.

Layer-independent error diagnostics, byte hashing and duration grammar belong to
`lib/errors`, `lib/hashing` and `lib/duration`. Application retains typed error
classification, payload field selection/serialization, retention policy and retry
decisions. Hash extraction preserves the exact persisted digest inputs and encoding.
Normalized incoming route identity and topic framing come from the OpenClaw routing
API; application still owns cross-store project selection and authorization.

## Capability contracts

Project registration and channel commands belong to `projects`. Registration checks
existing repository/branch/agent identity before provisioning, rechecks route ownership
under the registry lock, and reports post-commit scaffold failures for explicit retry.
Channel names are allocated from fresh locked state; unlink uses exact route identity
and retains at least one endpoint. Existing administrative authorization is preserved.

`issues/commands/research` owns stable-key research creation and exact-issue scheduling. It selects
an architect queue by its configured state key and validates its PICKUP target, rejects
ambiguous queues, and returns creation recovery and gateway delivery evidence separately.
Retries lock the issue and retain existing or uncertain reservations; provider labels
never select a retry transition. Workers consume the independent execution/context API. Attachment capture belongs to
issues/attachments; execution/context loads its persisted references without importing issue commands.

This README is the single application-layer contract; subpackages do not maintain
separate READMEs. Their file responsibilities and API details belong in source JSDoc.

- Explicit `initializeIssueRuntimeState` is the only projection-importing creation boundary;
  `writeIssueRuntimeState` updates existing records and rejects missing state. Matching
  creation-operation retries preserve the existing record rather than overwriting it.
  Runtime writes use fresh locked state, preserve omitted fields and null policy
  snapshots, and keep provider identity immutable. Workflow key/label overrides must
  match resolved configuration; unchanged stored pairs survive configuration drift.
  Transition, notification, and release intents commit atomically. Only explicit
  initialization or token-verified repair may import provider state. Repair rechecks
  snapshots/configuration and worker ownership under lock; inconsistent apply retains
  integrity errors.
- Task creation binds an idempotency key to an immutable payload and persists intent
  before provider mutation. Unknown creation without durable provider identity needs
  manual repair. Projection and provider read-back precede the local ready-state commit.
  Lifecycle commands lock and recheck readiness; body edits preserve managed metadata.
  Creation receives an explicit configured role list and rejects nested or unterminated
  submitted managed comments before recording intent or submitting a provider create.
  Original submitted bodies remain bound to idempotency; projection removes copied
  identity and read-back compares the resulting user content. Known-issue recovery
  restores creation identity from the durable operation. Body edits retain creation
  identity from local state, never from a provider-only marker.
  Attachment capture requires exact project/route identity and saves bytes before upload.
- Application/issues/projection selects exact workflow labels and colors from resolved configuration.
  Workflow label effects add the selected target before removing obsolete configured labels;
  required cleanup failures propagate, while optional final observations remain diagnostic.
  Provider label effects are a two-phase projection: failed cleanup may leave both source
  and target visible. Local reservation/record writes have their own atomic boundary;
  labels, gateway submission and local runtime persistence do not form one transaction.
  Recovery resumes explicit idempotent effects against the same managed issue/worker frame.
  Recovery uses fresh evidence to skip an already applied addition and resume cleanup.
  Provider observations verify projection only and never select local workflow transitions.
- Worker context is checked before reservation. Required task/PR/attachment/instruction
  content remains intact; comments use a count cap and budget, visible omissions, and
  at most one marked fragment. Only full comments receive acknowledgement. UTF-8 byte
  estimates are not model token counts; required overflow blocks dispatch.
  Non-formal review summaries retain local full-content fingerprints scoped to the exact
  PR URL and review ID. Submitted context remains pending until acceptance, exact worker
  completion or explicit operator confirmation; unknown delivery never acknowledges it.
  Completion can confirm captured context before the gateway's final CLI reply, and stale
  submission/session frames cannot confirm replacement turns. Verified non-start discards
  only the matching pending context. Receipts suppress duplicate heartbeat feedback events;
  retried workers still receive original feedback, since delivery does not prove resolution.
  Formal review decisions and edited summaries remain independently actionable.
- Dispatch validates the authoritative configured source pair and its exact PICKUP target.
  After model confirmation and projection, it commits a submitting worker intent before
  gateway submission. Failed intent persistence never submits a turn. Acceptance clears
  issue uncertainty before slot evidence; reconciliation can finish that exact settlement.
  Proven non-submission persists a source-state rollback and release intent before slot
  cleanup, so interrupted compensation remains recoverable.
  Dispatch atomically enforces capacity and execution mode. Proven local rejection
  rolls back reservation; unknown submission retains issue/slot ownership and evidence.
  Pre-submission failure attempts to restore the selected source projection even when adding the
  target succeeded and subsequent cleanup failed. Compensation starts from the attempted
  projection; known or uncertain submitted worker turns keep their reservation instead.
  Session existence alone proves nothing. Recovery persists an immutable operator
  decision before effects and requires exact issue/slot/session/submission identity.
  Pending recovery blocks competing operations; callbacks recheck identity under lock.
  Confirmed start retains ownership; confirmed non-start restores the validated queue
  and releases the exact slot. Completion requires an unambiguous current run and,
  for developers, a live conflict-free open PR; pipeline rechecks under lock.
- Dispatch requires a resolved role and resolves the selected level's explicit model before reservation. Removed or unknown levels fail without restoring registry defaults or interpreting levels as raw model IDs.
- After reservation, dispatch awaits confirmed session model setup before provider transition or worker submission. Setup failure releases the exact reservation while retaining the queued issue; uncertainty in a model patch alone does not imply a submitted worker turn.
- Workers own context-budget reset selection and its audit. Same-issue feedback preserves
  the existing context without querying the gateway; unknown usage retains the
  session. Reset requires observed usage strictly above the configured budget. Observation
  or exceptions from audit retain context; audit persistence remains best-effort. Dispatch
  separately decides how to handle optional
  deletion failure. Gateway adapters neither choose this policy nor write its audit.
- Notifications use the persisted exact endpoint without redirecting. Transport fallback
  is allowed only before submission. Terminal release precedes delivery and archival;
  unknown attempts require exact operator settlement and never automatically resend.
  Retry reservations recheck eligibility under lock; limits count reserved attempts.
- Archival rechecks ownership, releases, notifications, and integrity under lock.
  Deletion cannot discard unsent notification intent; only typed provider not-found
  proves absence. Retention compares fresh complete records, rejects active duplicates
  or occupied slots, and cleans attachments before removing records, retaining cleanup
  intent on failure. Audit never determines readiness, ownership, or recovery state.
- Heartbeat prevents overlapping ticks and runs recovery/maintenance before pickup.
  Manual health validates exact project scope before gateway observations and retains
  independent project/role inspection failures. Health includes persisted slots of
  disabled or removed roles; these are reported without inventing a replacement workflow
  or implicitly releasing their ownership.
  Recovery failure stops later project phases; workflow failures block that project's
  dispatch without suppressing independent projects. Diagnosis is read-only; remediation
  locks and rechecks local ownership. Provider absence alone never releases active work.
  Session absence in an incomplete gateway inventory is unknown and cannot authorize
  requeue. Uncertain-delivery evidence records that absence as null, retaining reservations.
- Worker bootstrap resolves instruction ownership by exact saved session and project
  agent identity, independently of built-in role names. Ambiguous matches fail closed;
  runtime configuration validates the selected role before any prompt path is read.
  Missing or removed role instructions leave the worker without orchestrator instructions.
- Setup previews are read-only; ordinary setup preserves files. Permissions derive
  from validated ownership in SDK-resolved workspaces, preserve unrelated/global rules,
  and deny nonowners. Corrupt registries block mutation. Routing requires enabled exact
  bindings and rejects conflicting owners; inspection does not prove live connectivity.
  Ownership and SDK configuration are not one transaction. Denied/pending scope evidence
  overrides positive fields; an unavailable scope command is nonblocking.
- Onboarding collects explicit role-level model overrides or accepts defaults. Reconfiguration guidance reads effective enabled workspace roles, including custom levels; it does not discover models or invoke LLM selection.

Within execution/workers, shared root evidence and session policy operations/constants may be imported directly
to avoid command-barrel cycles; recovery must not depend on dispatch. In workspace,
shared setup/runtime types come from workspace/types.ts; those type-only contracts
may import binding and permission types directly to avoid barrel cycles.

Task ownership commands select bulk candidates only from local configured queues and
recheck the queue pair, provider availability, local active/release ownership and fresh
project worker-slot reservations under each issue lock. A queue record with a reserved
slot remains unavailable even if dispatch has not yet committed its local active frame. Explicit single-issue claims retain their wider scope. Ownership commits before
label projection; repeating a claim for the same owner resumes projection, including
label-owned integrity failures, without transferring ownership again. Bulk results
retain independent failures and distinguish them from eligibility refusals. Discussion
commands validate configured attribution and publish comments without requiring or
initializing local workflow state. Comments are never automatically replayed.

Registration and administrative label sync share `projects/labels` catalog provisioning for
resolved workflow, enabled role/level and policy labels. Sync uses persisted provider
identity, validates exact scope before effects and retains independent project failures.
A failed catalog may be partially applied; repeating it is idempotent. Catalog
provisioning never scans issues, changes issues.json or reconciles issue projections.

Policy migration validates explicitly selected workflow keys against the resolved
project configuration before selecting local records or performing effects. Unknown
keys are errors, including when the managed issue store is empty; custom keys remain
valid when present in that configuration.

`issues/maintenance/administration` resolves project retention policy and persisted provider
selection for operator commands; adapters parse input and render the returned results.
Archive status/purge operate on local project stores without requiring a registry
entry. Delete requires a registered project and delegates fresh ownership and
recovery checks to deletion. Explicit confirmed reset replaces only active and
archive issue stores, under the state-owned store lock. It does not clear worker
slots, creation operations, delivery resolutions, attachments or provider data.
Reset remains available with damaged stores/configuration or a missing/corrupt
registry; its two file replacements are not a cross-file atomic transaction.

Setup endpoint discovery is read-only and target-aware. Routing enumerates exact
configured groups/topics using the same planned-binding diagnostics as setup apply:
channels/accounts must be enabled, own bindings remain selectable, and conflicting
owners are excluded. Wildcards are not endpoints. A proposed new agent exists only
in the discovery snapshot. The menu is not authorization: setup planning and SDK
mutation validate the fresh route again before writing. SDK read failures propagate;
discovery neither queries providers/gateway nor changes local runtime state.

The workspace root is a facade exposing administration and setup contracts. Internal
binding discovery and planned-binding diagnostics stay with workspace/bindings. Shared
route inspection and its DTOs belong to projects/routing; runtime consumers never
load setup merely to validate a destination.

Setup model queries reuse setup's target planning and return only effective enabled
role-level assignments, including custom identifiers. They perform reads only and
do not query model catalogs or request scope approval. Explicit overrides are
validated again during setup; unknown/removed levels and disabled roles fail before
effects. Standalone file recovery does not load or validate the existing workflow.

Workspace diagnostics exposes its canonical `WorkspaceDiagnosticsReport` DTO and `DOCTOR_SEVERITY` registry
for adapter-owned rendering without duplicating diagnostic protocol values.

Completion requires an exact captured worker frame, one matching active slot and live exact PR validation inside the issue lock. A completion receipt commits with transition/release/notification intents; only the same run/result resumes it after release. Archive-first duplicates resume before reconciliation alters the exact source snapshot.

Heartbeat also resumes terminal archive-first duplicates before provider projection
can change the exact source snapshot. Failed snapshot verification stops that pass.

`execution/workflow/effects` owns ordered merge, lifecycle, detection and optional checkout effects.
Pipeline planning delegates graph-edge resolution to domain/workflow; command errors,
worker ownership checks and execution of the selected transition remain application-owned.
Completion and heartbeat use this supported API while retaining policy and notification
ownership. Merge observes the captured exact PR, submits once per attempt and reads back
that same PR after an ambiguous response. Only confirmed merge/conflict selects a workflow
outcome; observation failure or unknown response retains the local source for retry.
Human review rechecks its configured approval gate under the issue lock. Review-skip's
explicit no-PR policy and human review's verified direct-base-commit path remain distinct.
Lifecycle setters inspect fresh provider state, and the ordered lifecycle result determines
committed closedAt and notifications. Completion receipts retain processed actions so
replay cannot report an unexecuted reopen after merge-conflict recovery. Provider effects
and local persistence are separate transactions; retry reconciles existing effects rather
than treating provider labels as authoritative transition evidence.

Queue ticks order canonical local queues by configured priority, then issue ID. They examine
capacity-blocked candidates without holding another issue lock and recheck only the selected
issue under its lock. Each tick makes at most one pickup per role and respects the total
pickup budget; atomic reservation still enforces role/project execution constraints.
Invalid source pairs or PICKUP targets never become managed candidates.

Route-based task lifecycle commands capture project and endpoint before locking and
validate that same target under its issue lock. Shared prerequisites reject creation
not ready, canonical state drift, missing provider identity and pending worker
release/resolution before provider effects. Start/level changes additionally require
no active worker or reservation; architect edits retain their operation-specific allowance.
Ownership-only writes preserve the stored workflow pair but do not bypass pending recovery.

Creation reconciliation budgets runnable attempts rather than unfinished records.
Manual/permanent failures and backoff are reported separately; candidates recheck
status/backoff under their idempotency lock before consuming budget. Persisted
reconciliation attempt counts rotate failed retries without modifying immutable payloads
or provider submission evidence. Concurrent stale selections do not repeat a newer attempt.
Collection queries may read one creation-readiness snapshot per invocation; mutating
lifecycle/dispatch paths retain fresh readiness checks under their issue lock.

Setup selects targets and coordinates SDK registration, integration-owned directories,
route/plugin configuration and state-owned scaffolding/model writes. Apply failures
raise SetupApplyError with the confirmed partial result, stopped step and exact recovery
target. A confirmed new agent is retained and resumed by existing agentId without
newAgentName; unconfirmed registration requires configuration inspection before retry.
Dry-run performs no provisioning. Ordinary existing-agent setup leaves implicit SDK
resource creation with the host while explicit registration plans can be resumed.

Operator tools render completion, dispatch, lifecycle and projection repair guidance from structured application facts. Worker prompts and outbound notifications remain application effects; gateway session labels belong to workers. Shared session-action semantics belong to domain/workers.

Issue-projection/verification owns provider/metadata verification, confirmation policy,
integrity persistence and its regression tests. Archive effects are mandatory composition-
injected callbacks: verification resumes archive-first duplicates before observing or
changing projection, without importing issues/maintenance back into reconciliation.
Heartbeat supplies the real archive callbacks; test callers exercise those same effects.

Workflow-execution owns planning, completion command/execution/replay, automatic review/
review-skip/test-skip passes, transition commit/release and ordered effects. Automatic-transition queries select only initialized local issues;
transitions owns the exact locked execution wrapper. Completion and automatic passes consume sibling planning/effects/
transitions APIs, never the ancestor execution/workflow barrel.

Domain/projects owns reservation queries returning reservation observations. Application
compares captured reservation frames with authoritative issue workers before transition
or release; a slot lookup never establishes managed runtime ownership. Workers retain
durable reservation/submission/settlement/recovery. Collection search reuses provider
observations only within one read-only invocation; mutations retain locked fresh reads.

Application aggregation barrels delegate supported child APIs with export *. Leaves
explicitly select their operations and contracts; workspace remains a facade. Heartbeat exposes
configuration and registration, while workers exposes health. The heartbeat service receives
its project-tick callback from registration and never imports the parent tick implementation.
Workspace configuration may import execution/heartbeat/configuration without loading timers. Shared parent
const/types contracts, worker evidence/session policy, workspace root/child types and heartbeat's
service context type remain narrow internal exceptions. Worker input no longer requires a
cross-capability tasks/context or tasks/attachments exception.

At the application root only index.ts, public-api.test.ts and this README remain. Root
heartbeat files share one periodic cycle: tick-runner sequences phases, pass-runner records
failure policy, maintenance-passes composes recovery operations, registration supplies the
service callback and scheduler adapts domain reservation exclusivity. Their const/types
contain only cycle reports, events and run inputs. Bootstrap/session evidence remains at
workers root because dispatch and delivery recovery share it independently of commands.
Projects separates registration, channels, context, routing and labels. Their shared
root contracts and endpoint selection helpers do not perform provider provisioning.

Issue commands separate activation (approval/start), assignment (owner/prepared level),
content (title/body), comments, creation and research. Read-only queries live at
issues/queries, independently of the commands aggregate. Internal prerequisites owns
captured-route/readiness checks and the shared approval lookup; its contracts do not depend
on activation commands. Issue-maintenance remains separate so workflow recovery does not
load research/dispatch through an aggregate issue-command barrel. Archive keeps recovery,
retention and queries together. Setup bindings owns discovery/planning/mutation; agents,
onboarding and permissions keep their existing contracts.

To locate a new operation: creation idempotency belongs to issues/commands/creation;
provider label definitions to projects/labels; issue label verification to issues/projection;
queue candidate choice to execution/scheduling; gateway submission/uncertainty to workers;
worker input budgets to execution/context; completion and automatic policy transitions to
execution/workflow; exact runtime destination checks to projects/routing; binding writes
to workspace/bindings. Persistence and locks always stay in state.

Task creation, discussion and manual attachments also return structured facts. Their tool adapters own readiness/repair guidance and command acknowledgements; provider comments, worker prompts and notification bodies remain application-owned effect content.
