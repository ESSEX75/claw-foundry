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

Shared terminal selection parsing and read-only configuration access belong to
`input`, whose entrypoint is used by sibling adapters. Issue identifiers must be
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
one DevClaw group; root `types.ts` owns only that composition boundary. Root
`const.ts` owns the private terminal audit actor shared by adapters. Internal CLI
code may import that constant directly, but must never import the root facade.

| Capability | Responsibility |
| --- | --- |
| `input` | Strict ID/selection/mode parsing, read-only SDK configuration and workspace resolution, and administrative input/runtime ports. |
| `setup` | Setup registration, raw model/options contracts, target/binding/model prompts, terminal session lifecycle and output. |
| `issues` | Composition and independent archive/delete/reset terminal handlers. |
| `repair` | Composition and independent issue repair/policy migration handlers. |
| `doctor` | Read-only diagnostic command and terminal report rendering. |
| `worker-delivery` | Exact worker-session/delivery recovery command and raw options. |

Capability entrypoints explicitly export registration (or shared input operations)
for siblings; they do not expose prompt, renderer, option or handler internals.
Siblings use the target capability's index. Files within one capability import
local implementation files and never their own or ancestor barrel. The facade does
not aggregate the internal registration APIs. Architecture checks enforce these
boundaries and prohibit direct filesystem/state dependencies in CLI adapters.

Production files remain flat inside each capability: setup's eight modules share
one setup invocation, while its types/constants stay with that owner. Root tests
exercise composition and outcomes across capabilities; individual parser, prompt
and model tests remain beside their implementations. Cross-adapter parity imports
the public CLI facade. No nested README or compatibility facade is supported.
