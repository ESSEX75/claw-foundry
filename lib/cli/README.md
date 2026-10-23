# CLI Layer

This layer owns command-line adapters.

CLI modules parse terminal input, call application use cases, and format terminal
output. Business behavior belongs in `lib/application`, not inside command
handlers.

The `worker-delivery` command previews or applies an operator-verified conclusion
for an unresolved worker turn. It requires the exact session key, delivery operation ID, and an audit reason;
application code validates the fresh issue and slot before changing either.

## Boundary Rules

- Keep command parsing and terminal rendering here.
- Move reusable behavior into `lib/application/*`.
- Do not write directly to provider or OpenClaw adapters when an application use
  case exists.

Use `npm run arch:check:strict` after changing this layer.

Setup calls the same application command as the setup tool, including preflight
and dry-run validation. `--eject-defaults`, `--reset-defaults`, and
`--refresh-instructions` select standalone file operations; ordinary setup preserves
existing files. Doctor remains read-only.

Shared terminal selection parsing belongs to `parsing`. Read-only SDK configuration,
workspace resolution and CLI runtime ports belong to `runtime`. Commands use each
capability through its entrypoint; neither capability registers terminal commands. Issue identifiers must be
positive safe decimal integers. Explicit CSV filters reject blank or invalid items;
only omitted options mean no filter. Application validates workflow filter keys
against the selected project configuration. SDK configuration failures remain errors
and are never presented as empty inventories or missing workspace defaults.

Repair and delete preserve their application JSON results. A classified repair
failure sets exit code 1. Delete apply sets exit code 1 until provider absence and
local archival are both confirmed; successful deletion previews remain successful
even though they perform neither effect. Successful commands never clear an
existing nonzero process exit code. Policy migration skips and no-change outcomes
are normal results rather than CLI failures.

Issue administration delegates policy/provider resolution and confirmed store reset
to application commands. CLI code does not load project/config stores or mutate
issue stores directly. Reset is destructive recovery for active/archive stores
only, not a cleanup of registry slots, creation/recovery evidence or attachments.

Setup binding prompts display application-provided exact endpoint choices for the
selected existing or proposed agent. Eligibility and topic peer encoding belong to
application routing; terminal code only renders destinations and collects a choice.

Setup accepts repeated `--model <role.level=model>` assignments for configured custom
and built-in levels. Built-in role-level flags remain supported explicit overrides;
help does not advertise registry defaults as current workspace settings. Repeating
a destination through either syntax is an error. Interactive model questions use
the selected target's effective enabled assignments and submit only entered values.

## Package API and ownership

External consumers import only `lib/cli/index.ts`, whose facade exposes
`registerCli` and its minimal `CliContext` contract. The root `register.ts` composes
one Claw Foundry group; root `types.ts` owns only that composition boundary. Root
`const.ts` owns the private terminal audit actor shared by adapters. Internal CLI
code may import that constant directly, but must never import the root facade.

| Capability | Responsibility |
| --- | --- |
| `commands/doctor` | Read-only diagnostic command and terminal report rendering. |
| `commands/issues` | Issues group composition and archive/delete/reset terminal handlers. |
| `commands/repair` | Repair group composition and issue repair/policy migration handlers. |
| `commands/setup` | Setup registration, raw model/options contracts, target/binding/model prompts, terminal session lifecycle and output. |
| `commands/worker-delivery` | Exact worker-session/delivery recovery command and raw options. |
| `parsing` | Pure parsing of issue IDs, selections and explicit preview/apply modes. |
| `runtime` | Read-only SDK configuration, workspace resolution and administrative runtime ports. |

`commands` is an organizational directory and has no barrel. Each command or command
group has its own `index.ts` and `register.ts`. Root `register.ts` composes those
entrypoints. A group's `register.ts` delegates to named modules such as `archive.ts`
and `delete.ts`; a single command may keep a small action callback with its option
definition. Separate output and prompt modules stay with their command owner.

Capability entrypoints explicitly export registration, parsing or runtime operations
for siblings; they do not expose prompt, renderer, option or handler internals.
Siblings use the target capability's index. Files within one capability import
local implementation files and never their own or ancestor barrel. The facade does
not aggregate the internal registration APIs. Architecture checks enforce these
boundaries and prohibit direct filesystem/state dependencies in CLI adapters. Parsing
cannot depend on runtime or command registration; runtime cannot depend on commands.

Production files remain flat inside each command capability: setup's eight modules share
one setup invocation, while its types/constants stay with that owner. Root tests
exercise composition, administrative input rejection and outcomes across capabilities.
Parser and configuration tests stay with parsing/runtime; prompt and model tests
stay with their command implementations. Cross-adapter parity imports
the public CLI facade. No nested README or compatibility facade is supported.
