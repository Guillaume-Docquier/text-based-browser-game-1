# Use native Vitest test declarations

## Status

Accepted

## Context

When tests used an imported function created by `test.extend()`, 19 of our 31 Oxlint Vitest rules missed violations or reported valid code. For example, a focused test could pass CI, and `require-hook` could flag a valid test declaration. [Fixture audit #671](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/671)

## Decision

Declare Vitest tests with `it` or `test` imported from `vitest`. Acquire test resources through explicit helpers. The database setup may use its internal worker fixture to share initialization and preload PostgreSQL before the first concurrency test runs in CI.

## Consequences

Oxlint can check test declarations consistently. Tests that need a database must request it explicitly. Revisit this decision when Oxlint supports fixture imports and extended test functions, and the audit confirms that equivalent tests produce the same diagnostics. [Fixture import setting #22323](https://github.com/oxc-project/oxc/issues/22323) · [Extended test detection #26675](https://github.com/oxc-project/oxc/issues/26675)
