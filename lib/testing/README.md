# Testing Package

This package owns reusable test harnesses, fakes, and test-only helpers for DevClaw.

## Boundary Rules

- Keep production behavior out of this package.
- Model external capabilities with deterministic fakes rather than network or provider calls.
- Provider fakes apply and record explicit label effects; workflow selection is exercised
  through the application projection use case rather than duplicated in the fake.
- Reuse public production contracts and avoid creating divergent test-only domain models.
- Keep narrowly scoped fixtures beside their owning tests when they are not shared.
- Harness cleanup retries transient removal failures because advisory notifications
  and their diagnostic writes may still finish after dispatch/completion returns.
  This is bounded temporary-directory cleanup, not a guarantee that background effects
  have completed; assertions about those effects must await their own evidence.
- Shared provider scenario registration and CLI fixtures live in the focused
  `provider-*-scenarios.ts` modules. Importing them does not register tests;
  concrete provider tests invoke the scenarios beside the owning capability.

Run the affected focused tests and the full suite after changing shared test infrastructure.
