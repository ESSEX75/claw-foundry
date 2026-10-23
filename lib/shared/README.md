# Shared primitives

Owns small technical primitives used across Claw Foundry layers, without workflow,
project, provider, persistence or SDK policy.

## Ownership and APIs

`shared` is an organizational directory and deliberately has no root `index.ts`.
Consumers import the specific capability API or one of the two shared root files.

| Owner | Supported contract |
| --- | --- |
| `errors/index.ts` | Unknown-error message formatting, validated string-code narrowing and `CodedError`. |
| `hashing/index.ts` | Exact-byte or UTF-8 SHA-256 hexadecimal digest. |
| `duration/index.ts` | Explicit integral duration grammar and safe millisecond parsing. |
| `types.ts` | Universal type construction `ValueOf<T> = T[keyof T]`. |
| `const.ts` | `CLAW_FOUNDRY_PLUGIN_ID` for registration/configuration and the separate `PERSISTED_PROTOCOL_NAMESPACE` for existing issue markers and gateway replay keys. |

Capability internals import local implementation files, never their own barrel.
Other consumers use the owning capability's `index.ts`; private constants and
implementation modules are not external APIs. Root types/constants are imported
directly because they have no separate package boundary.

## Dependency and behavior contracts

- Shared code may depend on platform APIs, general-purpose libraries and other
  shared primitives. It must not import other repository layers or plugin composition.
- Keep filesystem/network operations, SDK context, storage, locking and audit outside
  this directory. Hashing uses `node:crypto` but performs no filesystem operations.
- Error helpers neither infer retry policy nor interpret nested causes or provider
  outcomes. Callers retain classification and recovery decisions.
- Hash callers own payload selection, serialization and persisted digest identity.
  The primitive does not canonicalize JSON or normalize text.
- Duration parsing rejects invalid syntax and unsafe integer results. Callers own
  retention policy, scheduling and defaults; syntax validation alone does not prove
  that the converted duration fits the safe range.
- Keep domain types and constants with their domain owners. Universal types and
  plugin-wide identifiers are the only responsibilities of the two shared root files.
- Tests stay beside their capability. Do not add nested README files or compatibility
  exports at the former root locations.
