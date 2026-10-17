# Tools Layer

This layer owns OpenClaw tool adapters.

Tool modules validate tool inputs, resolve runtime context, call application use
cases, and format tool results for OpenClaw. They are the boundary between the
agent-facing plugin API and deterministic DevClaw behavior.

Each adapter owns a strict Zod input schema and derives its SDK JSON Schema from
that same definition through `validation`. Parsing precedes context resolution and
all effects. Shared primitives validate nonblank text and positive safe issue IDs;
business eligibility and configured role/level/completion membership stay in application.
Unknown arguments and non-boolean confirmation flags are rejected without coercion.

## Boundary Rules

- Keep OpenClaw tool context handling here.
- Manual health calls application/heartbeat. An omitted project slug explicitly selects
  all registered projects; unknown scopes fail and never become a successful empty scan.
- Move reusable business behavior into `lib/application/*`.
- Do not access provider or state internals directly when an application use case
  exists.
- Project label catalog synchronization calls application/labels; the application validates
  exact scope and provisions definitions using persisted provider identity. Issue projection
  reconciliation remains a separate operation.
- Register public tool factories in `lib/tools/registration`.
- Project registration and channel mutations call application/projects. Filesystem
  scaffolding is state-owned; a committed registration with failed scaffolding is
  returned as `scaffold_pending` and can be completed by repeating the same request.
- Creation adapters must call the shared durable use case and report pending or
  manual-repair states honestly; only a `ready` operation is successful.
- Research requires a stable caller idempotency key and optionally an explicit queue
  state key. It calls application/tasks and reports creation and delivery separately,
  including exact unresolved submission IDs; a retry never blindly resends a worker turn.
- Channel-only task adapters reject ambiguous destinations. Adapters with a full
  account/channel/conversation/thread identity use application project context
  resolution and never choose the first project or endpoint.
- Channel removal requires channel, account, conversation and optional thread identity;
  it rechecks that exact endpoint and the last-channel constraint under the registry lock.

Use `npm run arch:check:strict` after adding or changing tool factories.

Setup, configuration, and onboarding tools call application/setup. They must not
read or write filesystem state directly. Setup dry-run applies to every operation,
including reset and instruction refresh.

## Public API and capability ownership

External consumers import `lib/tools/index.ts`. This supported API aggregates leaf
factory APIs, public tool-name constants and the SDK-typed registration catalog.
It does not expose private schemas, output shapes, context resolution or guide builders.
Inside tools, use the target capability's entrypoint; task capabilities use their
immediate sibling entrypoint, and outside task capabilities use `tasks/index.ts`.
Never import the tools root or an ancestor task barrel from its own implementation.

| Capability | Owned adapter responsibility |
| --- | --- |
| `registration` | Fixed public names and SDK factory composition, with no widened unknown factory result. |
| `context` | Explicit conversation input and SDK workspace resolution; no project/provider decisions. |
| `validation` | Shared nonblank text, conversation and safe issue ID schemas, and SDK schema generation. |
| `setup` | Setup, onboarding and configuration operations through application/setup. |
| `projects` | Registration and formatting of local project information. |
| `channels` | Exact endpoint linking, unlinking and listing. |
| `health` | Manual inspection scope and application/heartbeat result formatting. |
| `labels` | Label-definition provisioning through application/labels. |
| `guidance` | Topic protocol/schema, SDK selection, and pure reference content. |
| `issues` | Explicit repair, policy migration and deletion adapters. |
| `tasks/creation` | Durable task creation and resumable research requests. |
| `tasks/lifecycle` | Approval, prepared level, ownership and user-content edits. |
| `tasks/discussion` | Comment input and application discussion results. |
| `tasks/queries` | Local-state-first task browsing and dashboard formatting. |
| `tasks/attachments` | Manual attachment commands through application/tasks. |
| `worker` | Worker completion boundary and application result formatting. |

Adapters keep private input schemas beside their execution boundary. Shared schemas
belong to validation; guidance's topic registry, type and schema stay with guidance.
Public protocol names belong to each capability's `const.ts`; output types stay in
the owning `types.ts`. The root contains only the public aggregation entrypoint and
this contract. Focused leaf adapters remain together where they share a command
contract; independent responsibilities do not accumulate under an admin bucket.

Ownership and comments call application/tasks. Bulk claims select only local queues,
recheck eligibility under the issue lock, retain individual failures and resume an
already committed owner's failed label projection. Provider labels/body metadata
never initialize or select managed workflow state implicitly. Project slots expose
reservation evidence separately from authoritative issue workflow state.

## Verification ownership

Tool tests execute real factories and `execute` methods to verify SDK context,
input rejection before effects, application delegation, result formatting and failures.
They replace external provider capabilities with test-scoped fakes while retaining
real application decisions and persistence. Do not simulate production decisions in
local copies or use unconditional assertions. Domain/role tests live with pure
semantics; creation, projection summaries, lifecycle locks and worker recovery tests
live beside their application owners. Root registration tests exercise the external
public API and preserve the exact registered names. Broad architectural refactors
must pass arch/check/build/full tests and a logic review before committing.

Setup partial-apply errors are returned as unsuccessful structured results with the
stopped effect, confirmed agent creation and recovery target. They never become a
successful setup response merely because registration or configuration already committed.

Tool adapters own operator announcements and CLI repair guidance rendered from structured application outcomes. Task query adapters preserve projection evidence while adding repair/delivery hints.
