# State Layer

This layer owns local persistence.

Shared error text/string-code narrowing, SHA-256 mechanics and duration syntax are
consumed from `lib/errors`, `lib/hashing` and `lib/duration`. State retains lock and
filesystem recovery policy, payload serialization and all persisted schemas. Missing
file handling requires a real Error with the exact string code; nested causes are
unwrapped only by the repository that created the contextual wrapper. Duration schema
validation uses the common grammar without changing existing accepted raw syntax.

State modules read, write, and lock DevClaw project files such as
project config, setup files, and managed issue runtime state. They may use domain
types, but they should not contain queue scheduling or worker dispatch behavior.
Strict store envelopes and resumable operation records are state-owned public
contracts exposed to other layers only through `lib/state/index.ts`.

## Package API

- `lib/state/index.ts` is the only supported entrypoint for code outside this layer.
- The root entrypoint re-exports supported subpackage APIs with `export *`.
  Subpackage entrypoints select their public contracts explicitly; the root keeps
  only the shared filesystem names from `paths.ts` as named exports.
- Internal state modules import implementation owners directly and never import the root entrypoint.
- State schemas, parsers, filesystem locks, and persistence helpers stay private unless an exported operation is itself the required boundary API.
- `lib/state/paths.ts` owns filesystem names shared by multiple state capabilities.
- `lib/state/persistence` owns process-backed directory locking, timestamp validation,
  and atomic replacement used by state repositories; it is not exported from the root API.
- Internal capabilities use sibling entrypoints. The narrow transaction exception is
  `issues/archive/transaction.ts` accessing `issues/active/repository.ts` for validated
  writes while already holding the shared store lock. Attachments may read
  `issues/archive/repository.ts` directly to avoid loading archive retention back into
  the attachment API. Neither raw writer is exported through the state root.
- `setup` is an explicit facade: internal resources and document mechanics are not
  aggregated into the external API. `worker-delivery/markers` is an internal schema
  entrypoint shared by registry slots and issue workers without loading recovery effects.
- `attachments/cleanup` exposes retention manifests and purge independently from save
  repositories. Archive retention uses this entrypoint to avoid a reverse dependency
  through attachment saves back into archive records. Parent attachment paths, constants
  and the common lock remain shared internal mechanics of that attachment capability.

## Lock Ownership and Recovery

Locks are nonempty directories containing one immutable, uniquely named ownership
marker. A prepared sibling directory is renamed into place only after the marker
has been written. Cleanup unlinks only the observed token and uses non-recursive
`rmdir`; delayed cleanup cannot remove a replacement owner's nonempty directory.

Lock age only controls when to inspect process liveness. A live local process never
expires, even after an event-loop pause. Recovery requires the same hostname and an
OS `ESRCH` result for the recorded PID. Permission failures, foreign hosts and PID
reuse fail closed; they may require operator inspection. These locks assume local
storage, one host PID namespace and cooperative writers. External lock deletion
while a process is live is unsupported. Atomic file publication does not claim
power-loss durability or cross-file transactionality.

The ownership format intentionally replaces the former lock file format. Stop all
old writers before upgrading; inspect and remove abandoned old lock files manually.
Unknown, malformed and linked lock entries are errors, never automatically deleted.
Interrupted preparation may leave an unpublished `.claim-*` sibling; it never owns
the protected resource and may be removed after stopping and inspecting writers.

Persisted timestamps require ISO date-times with explicit timezone and valid calendar
values. Existing malformed records are rejected with no normalization or automatic
reset. Before upgrade, inspect and repair affected date fields using authoritative
evidence, preserving a backup; do not invent timestamps or discard runtime records.

If an existing project uses a newly rejected device basename, migrate its identity
explicitly before upgrading: stop writers, back up the workspace, choose one portable
slug, and update the registry key/slug, project directory, store envelopes and nested
project references, archive keys, attachment directory and scoped configuration together.
Verify archive-first duplicate snapshot identities before resuming recovery. A directory
rename or registry-only edit is insufficient; no compatibility alias or implicit rename
is provided. This change does not alter the serialized shape of valid runtime records.

`npm run test` includes separate-process contention and abrupt-owner-exit checks,
including a live event-loop pause longer than the abandoned-owner inspection age.

## Managed Issue Stores

- `issues.json` contains active managed issue state only.
- Active issue workers may contain an optional unresolved delivery marker; the
  same marker on a project worker slot protects ownership if issue state commit fails.
- Active issues can retain non-formal review-summary receipts and pending submitted
  context bound to a submission ID and exact worker frame. Locked runtime updates preserve
  these facts without selecting workflow transitions. Application alone supplies acceptance,
  completion or operator evidence; provider reactions and session presence cannot acknowledge
  pending context. Receipt fingerprints do not store the original review text.
- `issues.archive.json` contains archived records and deletion tombstones only.
- `issue-creations.json` contains resumable creation operations and idempotency
  keys; these records are not active runtime state.
- `issues/creation` owns the operation-stage and failure-code registries and their
  derived types, exposed through the state API. These identifiers do not determine
  the workflow state of an initialized issue.
- `issues/active`, `issues/archive`, and `issues/creation` are separate internal repositories with their own types and strict schemas.
- `issues/persistence` owns the project lock shared by active/archive transactions; neither repository owns the other's synchronization policy.
- Issue-store reads have no write side effects; only locked updates and explicit state-owned transactions initialize or replace durable stores.
- Active and archive files share one per-project lock. Archival writes the archive record before
  removing active state so an interrupted operation can be recovered idempotently.
- Archive-first recovery refuses to discard active state when an existing archive
  record refers to a different source snapshot.
- Retention compares the entire selected archive record under this same lock,
  refuses active duplicates, and retains the record when attachment cleanup fails.
  It writes `archive-retention.audit.jsonl` before the first attachment unlink;
  journal errors abort cleanup. This append-only intent evidence is retained after
  record expiry and is not automatically truncated with the general audit log.
- Workflow commits can retain `pendingWorkerRelease` and a never-attempted
  notification intent in the same active record. Pending notification intents are
  immediately reservable; their initial timestamp records intent creation.
- Terminal notification reservation returns an exact timestamp token. Settlement
  compares both event identity and token, so stale attempts cannot settle a new send.
  The lease duration is public so application retries can omit candidates still in
  backoff; reservation remains the final eligibility check under the store lock.
  Expired in-flight attempts become `unknown`, never automatically reservable.
  Proven unsubmitted (`retryable`) and policy-blocked attempts can be reserved after
  backoff. Delivered events remain deduplicated; unresolved events cannot be replaced.
  A verified late outcome may settle its own unknown attempt. An operator-reviewed
  unknown can be settled as delivered or retryable through this same API; the caller
  owns evidence validation, and storage never infers delivery from time alone.
- Stores accept only their current strict schema. Destructive reset is an explicit
  operator action and must never run automatically during startup or reads.

## Attachments

`attachments` owns validated metadata, local bytes, atomic indexes, and the common
save/URL-update/purge lock. Its public operations are exposed through the state
entrypoint. Reads distinguish missing state from corruption or access failures.
Purge refuses linked ancestors and nested entries, and never traverses recursively.
Attachment saves acquire the issue-store lock before the attachment lock and
reject archived issue identities. Retention follows the same lock order. URL
updates still reject files removed by cleanup and cannot recreate their index row.
Saves use unique filenames and publish the index atomically; index-write failure
removes only the new file. Purge includes unindexed bytes left by interrupted saves,
validates every entry before deletion, unlinks individually, and removes the index
last, allowing partial cleanup to resume. Paths require canonical project slugs,
positive safe issue IDs, and flat safe basenames. Reads never create storage.
These checks assume trusted workspace ancestors and cooperative local writers;
they cannot prevent a hostile process swapping paths between inspection and I/O.

## Projects Registry

- `projects/paths` owns registry and repository path policy, including home-directory expansion.
- `projects/repository` owns strict reads and immutable, locked atomic updates; raw production writes are not public.
- `projects/queries` contains pure snapshot lookups, while `projects/mutations` owns worker-slot persistence operations.
- Worker activation checks optional configured capacity and cross-role sequential
  exclusivity inside the same registry transaction that reserves the slot. Lingering
  active roles also block exclusivity, even if disabled in the current configuration.
- Automatic reservation uses the same domain capacity selector as preview planning;
  unresolved issue references and delivery evidence cannot be overwritten. Explicit
  release uses the shared domain transformation after validating the selected owner.
- Optional cross-project sequential execution is checked in the same registry transaction
  as reservation; concurrent dispatches cannot both claim different projects.
- Project queries and mutations accept only the canonical project slug; notification routing is resolved before entering state.
- Canonical slugs use strict lowercase kebab-case and must match their registry key; display names never address files or registry entries.
- Slugs also reject reserved Windows device basenames before registry or filesystem writes.
- The registry accepts only its current schema and performs no legacy field or identifier normalization.

## Configuration Pipeline

- YAML boundary reads return `unknown`; only the strict current schema creates raw configuration values.
- Pure merge preserves built-in → workspace → project precedence, including explicit role and level disabling.
- Disabling a built-in role preserves its inherited definition; sparse later overrides keep it disabled until `enabled: true` is explicit. Removed levels require a complete definition to be restored.
- Instance identity follows the same workspace → project override precedence.
- Resolution completes runtime contracts before separate role/workflow cross-reference integrity checks.
- Built-in role and workflow definitions enter only through the initial configuration layer; resolution completes merged values without restoring removed levels or regenerating role defaults. Runtime fallback policy values belong to `config/const.ts`.
- Project configuration paths are addressed only by the validated canonical slug.
- Only `loadConfig` and resolved runtime selectors are public outside state; parsing details remain internal.

## Setup Files

Setup resources owns package discovery and cached templates; workspace owns create-only
initialization and project scaffolding; documents owns per-document synchronization,
atomic replacement and backups; configuration owns YAML reads, model patches and resets;
instructions owns prompt precedence and explicit system instruction refresh. Constants
and types stay with these capabilities. Shared resource filenames belong to resources.
Only index.ts remains at the setup root because it is a supported facade.

Create, patch, reset and refresh share a per-document lock. Model patches read fresh
content under that lock and preserve comments and unrelated settings. Replacements
atomically publish the exact prior text to `.bak` before atomically replacing the
document. Backup failure prevents replacement; destination failure leaves the old
document and recoverable backup. Multi-document reset is intentionally resumable file
by file, not an atomic transaction across all defaults.

Project override scaffolding validates the slug and exclusively creates documentation;
existing regular files are preserved. Non-file collisions and write failures propagate
so application can report a committed registration with pending scaffolding.

- Template loading is explicit and asynchronous; import-time filesystem reads are forbidden.
- Initialization is create-only, while system instruction refresh and default reset are explicit capabilities.
- Reset preserves adjacent `.bak` files as a recovery feature, not as a compatibility mechanism.
- Workspace version tracking and legacy onboarding-file cleanup are not part of the new-project contract.
- Project-specific role prompts are addressed only by the validated canonical slug.

## Boundary Rules

- Keep filesystem paths, serialization, and lock handling here.
- Do not import `lib/tools` or `lib/cli`.
- Do not call provider APIs or OpenClaw session APIs.
- Do not own workflow transitions that require application orchestration.

Use `npm run test` after changing issue state behavior, and
`npm run arch:check:strict` after structural changes.

Workflow model patch persistence preserves other YAML settings and comments and
creates a backup. Scoped configuration resets and workflow document reads belong
to state; application selects the operation and validates configured identifiers.

`readOptionalProjects` supports ownership discovery in uninitialized workspaces.
Only a missing registry yields `undefined`; malformed or inaccessible registries
remain errors, and the operation never creates files.
`inspectManagedWorkspace` canonicalizes an existing SDK-resolved workspace before
this strict optional read, so symlinked or alternate path spellings share identity.


`worker-delivery` stores the latest operator delivery decision per issue in
`worker-delivery-resolutions.json`, under the issue-store lock. Intent is immutable
and survives slot release and runtime replacement. Only the same decision may be
marked complete; a different submission may replace only a completed record.
Corrupt or unreadable recovery evidence is an error, never an empty store.

Active records may retain completion receipts bound to the exact worker run, result and committed destination. Application supplies these atomically with transition intents; persistence never infers completion from project slots or provider labels.

Completion receipts validate their processed workflow action sequence. This preserves
the lifecycle outcome of a recovered merge conflict independently of later configuration.

Creation operations optionally retain a reconciliation-attempt count, distinct from
provider submission attempts, so application scheduling can rotate retries durably.
Creation readiness query APIs produce per-invocation snapshots only; callers must
not reuse them to authorize a later mutation. Strict locked readiness reads remain available.

SDK-owned OpenClaw agent directories are provisioned by integrations/agents. State
continues to own only DevClaw workspace scaffolding, instructions and model YAML writes.
