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
- Workflow label synchronization calls application/projection with resolved configuration;
  tool adapters validate project selection and format results, while providers apply explicit labels.
- Register public tool factories in `lib/tools/registry.ts`.
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
