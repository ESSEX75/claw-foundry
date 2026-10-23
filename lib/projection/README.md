# Projection Layer

This layer owns the deterministic projection between local issue runtime state
and provider-visible issue data.

The `labels` capability renders and diffs managed workflow, routing, owner,
policy and notification labels. The `body` capability owns compact metadata,
durable creation markers, comment framing and composition. Local `issues.json` state remains the
source of truth for managed issues; provider labels and metadata are the visible
projection of that state. Managed metadata identifies the project and issue;
it contains no schema version or migration protocol.

Hidden creation markers bind provider issues to durable creation operations and
are verified before the application publishes an issue for lifecycle processing.

`composeManagedIssueBody` removes submitted managed blocks and appends metadata
and creation identity supplied by the application from trusted state. It is pure
and cannot select or validate a task's lifecycle eligibility.

## Public API and ownership

- External consumers use `lib/projection/index.ts`, which aggregates `body/index.ts`
  and `labels/index.ts`. Capability entrypoints explicitly name supported exports.
- Sibling capabilities use the owning capability's entrypoint; implementation files
  use local imports. Protocol constants, framing helpers and validation guards remain private to their capability API.
- `labels` owns `render.ts`, `classification.ts`, `diff.ts`, `types.ts`
  and its tests. The configured role list is required; an explicit empty list owns
  no role namespaces. Missing roles are rejected, never interpreted as all roles.
- The plugin ID prefix alone grants no label ownership. Labels such as
  `claw-foundry:example` are preserved unless configured workflow/roles or exact local
  expectations independently establish their ownership. Body block identifiers
  belong to the separate body protocol and do not reserve provider label names.
- Exact labels expected from local state remain managed even when current workflow
  labels or role configuration change. Such drift cannot implicitly rewrite local
  fields. Label observations are compared as sorted distinct sets.
- `body` owns metadata, creation markers, composition, framing helpers, guards,
  types, constants and its tests. Root files are limited to this layer contract
  and the shared external API; nested README files are not used.

## Body protocol and failure semantics

The persisted body namespace remains `devclaw` across the Claw Foundry rebrand.
It is independent of the plugin registration ID, preserving existing provider
metadata and durable creation recovery without modifying user issue bodies.

- Metadata contains only `projectSlug` and a positive safe-integer `issueId`.
  Extraction returns compact identity and discards unrelated JSON fields.
  Rendering escapes HTML framing characters inside JSON values.
- Extraction accepts exactly one canonical valid block of the requested kind.
  Missing, malformed or duplicated blocks return `null`; the first block never
  overrides competing identity evidence.
- `replaceIssueMetadata` removes all closed metadata blocks, including malformed
  payloads, and appends one trusted block. It preserves creation markers and user
  text outside the removed blocks, normalizing trailing whitespace.
- `stripManagedIssueBody` removes both managed block kinds. `composeIssueCreationBody`
  adds only the trusted creation marker before a provider issue ID exists.
  `composeManagedIssueBody` adds trusted metadata and an optional local creation
  identity. Omission removes submitted/provider markers rather than adopting them.
- Nested or unterminated managed comments are ambiguous. Extraction returns `null`;
  stripping, replacement and composition throw rather than consume an unknown range
  of user text. The application decides how to report or repair the failure.
- Creation keeps the original submitted payload for idempotency and verifies its
  user content after managed-block removal. Creation recovery restores identity
  from its durable operation; body edits retain identity only from local state.

## Boundary Rules

- Keep projection helpers deterministic and side-effect free.
- Do not read or write `issues.json` here; use `lib/state/issues`.
- Do not call GitHub, GitLab, or OpenClaw APIs here.
- Do not treat manual provider label edits as authoritative runtime state.

Use `npm run test` after changing projection behavior.
