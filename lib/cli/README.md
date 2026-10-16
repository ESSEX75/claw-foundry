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
