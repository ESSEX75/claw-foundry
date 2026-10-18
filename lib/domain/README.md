# Domain Layer

This layer owns pure DevClaw semantics.

Domain modules define workflow types, role/project/issue concepts, labels,
policies, IDs, and deterministic helper functions. Code here should be safe to
execute without filesystem access, provider clients, OpenClaw runtime context, or
CLI state.

Domain may define the semantic issue and project records used by persistence,
but store envelopes and resumable operation records belong to
`lib/state`.
Creation-operation stages and failure identifiers belong to `state/issues/creation`
alongside their persisted operation contract; they are not issue workflow states.

Package ownership is explicit: `notifications` owns messaging endpoints and
notification routing labels, `issues` owns provider IDs and issue ownership,
`projects` owns project and worker-slot structures, `workers` owns shared worker
delivery status, and `workflow` owns state machine semantics and workflow routing.

Workflow owns saved policy selectors and their local issue-field identifiers shared
by candidate selection and transition rechecks.

Workflow owns policy-label prefixes shared by projection rendering, repair parsing,
and application label effects. Issue semantics own the diagnostic used to preserve
a non-OK integrity status when its original diagnostic owner is unknown.
Review/test routing builders share exhaustive domain mappings with catalog rendering
and explicit projection import. Test-phase inspection means any queue or active state
of the built-in tester, independently of policy; custom role names imply no QA capability.

Worker slot and active issue records share a durable delivery marker so both
local ownership views can represent an unconfirmed worker turn.

## Boundary Rules

Projects own pure available-slot selection and sequential execution exclusions. Both
preview planning and locked state reservation use these rules; slot references requiring
reconciliation are never recycled merely because their active flag is false.
Inactive slots retaining delivery evidence are likewise unavailable until explicitly
released. Reconciliation retains these reservations even outside configured capacity.

- Do not import from `lib/application`, `lib/state`, `lib/integrations`,
  `lib/tools`, or `lib/cli`.
- Do not perform IO.
- Do not know about GitHub, GitLab, OpenClaw sessions, or command-line parsing.
- Do not place migrations here.

If a function needs runtime state, provider data, or filesystem access, it belongs
outside `lib/domain`.

## Public API

- `lib/domain/index.ts` is the public entrypoint for the complete domain package.
- Every domain subpackage exposes its supported API through its own `index.ts`.
- The root entrypoint re-exports the supported subpackage APIs with `export *`;
  subpackage entrypoints explicitly select the values and types they expose.
- Code outside `lib/domain` imports domain entities from `lib/domain/index.ts`.
- Cross-subpackage imports use the target subpackage's `index.ts`.
- Domain internals never import from the root `lib/domain/index.ts` barrel.

## Domain-specific contracts

- Keep YAML parsing, Zod boundary schemas, persistence, migrations, locks, provider calls, audit logging, and runtime orchestration outside this layer.
- Derive closed domain value unions from their canonical constant registries through `ValueOf`.
- Keep narrow built-in identifiers distinct from extensible identifiers validated from resolved runtime configuration.
- Built-in completion guards do not validate configured custom results. Projected-label
  inspection returns a diagnostic first match, never authoritative managed state.

Issue semantics own terminal-notification states: pending, attempting, delivered, blocked,
retryable, and unknown. Attempt timestamps identify the owned send, while persisted
reasons distinguish policy blocks from uncertain external effects.

A completed issue may retain the exact worker identity awaiting project-slot
release. This is an ownership guard until application recovery finishes the release.

Worker delivery markers carry a submission ID distinct from reusable session
identity. Domain owns operator decision values; state owns resumable decision records.

Issue semantics own non-formal review-summary receipts and pending submitted context
bound to an exact worker frame. These describe delivery evidence, never review resolution
or provider-label authority. Application decides when external acceptance, completion
or explicit operator evidence may confirm that pending context.

Worker semantics expose exact run identity comparison (including start time); projects
own the pure transformation of a verified released slot. Application owns the evidence
authorizing release, and state owns conditional persistence.

Issue semantics own completion receipts bound to the exact worker run and result. They describe a committed transition and cannot authorize another run.

Workflow owns pure ordered lifecycle metadata resolution. Application supplies timestamps
and successfully processed actions; provider observations never determine local closedAt.
Completion receipts retain that processed sequence for accurate same-run replay.
Workflow also resolves configured edges by canonical source key and event, retaining
destination keys, labels and descriptions. Application owns result validation,
transition authorization, provider effects and persistence of the selected edge.

Workers also own the shared session-action registry and its derived type, used by dispatch and notifications without application implementation imports.

Project slot semantics expose exact run and reservation comparisons alongside the shared released-slot transformation. Callers retain active, delivery-token and release authorization policy.
