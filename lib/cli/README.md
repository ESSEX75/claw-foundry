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
