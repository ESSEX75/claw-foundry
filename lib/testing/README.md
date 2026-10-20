# Testing Package

Owns reusable test infrastructure, never runtime plugin behavior. External tests use
`lib/testing/index.ts`; the root aggregates supported capability APIs. Internal
siblings use the immediate capability entrypoint, and implementations never import
an ancestor barrel. Do not import test infrastructure from production code.

## Responsibilities

| Capability | Ownership |
| --- | --- |
| `commands` | SDK-compatible command interception, validated gateway metadata, invocation snapshots and complete process responses. |
| `providers/fake` | In-memory provider effects and typed call evidence, independent of workflow decisions. |
| `providers/scenarios` | Cross-adapter contract scenarios and CLI response fixtures; tests register scenarios explicitly beside concrete providers. |
| `workspace` | Temporary project scaffolding, role prompts, bootstrap simulation and harness lifecycle. |
| `state` | Explicit managed issue initialization, worker binding and completion fixtures using production state/application APIs. |
| `setup` | Isolated SDK config snapshots, serialized mutations and captured scope commands. |
| `contracts` | Repository architecture and tool registration checks; no reusable API or barrel. |

Only the public API and this layer contract remain at the root. Types and resource
constants belong to their capability's `types.ts` and `const.ts`; keep private
implementation details out of entrypoints. Narrow fixtures and tests stay beside
their owner rather than becoming shared automatically.

## Behavioral contracts

- Fakes model external effects without network or provider calls. Workflow and
  projection decisions remain in the real application code.
- Reuse production contracts rather than maintaining competing domain models.
- Captured command arguments, options and provider call payloads are snapshots;
  later mutation by callers does not rewrite invocation evidence.
- Gateway metadata is parsed as unknown and captured only after field validation.
  A malformed session patch cannot fabricate a resolved model response.
- Comment IDs are unique within a fake instance, including multiple calls during
  the same clock tick. Reset clears both effects and identity counters.
- Setup mutations serialize against the latest committed config; rejected mutations
  do not poison later operations. Current config and commit history are independent
  snapshots. Unchanged drafts do not create a recorded write.
- Managed runtime is initialized only explicitly. Provider-only fixtures never
  become authoritative local state implicitly.
- Harness workflows are independent snapshots. Built-in worker roles come from
  `getAllRoleIds()`; fixtures may still supply explicit custom-role reservations.
- Harness cleanup retries transient removal failures because advisory effects can
  finish after dispatch/completion returns. Cleanup does not prove those effects
  completed; assertions must await their own evidence.

Run focused infrastructure regressions and the complete verification workflow after
changing shared helpers. Repository checks and helper regressions are discovered by
the normal recursive Node test runner; importing the public API registers no tests.
