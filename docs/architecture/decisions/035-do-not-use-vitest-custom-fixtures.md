# Do Not Use Vitest Custom Fixtures

## Status

Accepted

## Context

When tests used an imported function created by `test.extend()`, 19 of our 31 Oxlint Vitest rules stopped reporting correctly. [Fixture audit #671](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/671).

This is a known issue with a feature request:

- [Fixture import setting #22323](https://github.com/oxc-project/oxc/issues/22323)
- [Extended test detection #26675](https://github.com/oxc-project/oxc/issues/26675)

Eslint supports this, it's just Oxlint, and I don't want to use eslint.

## Decision

Declare Vitest tests with `it` or `test` imported from `vitest` only, do not use Vitest custom fixtures.

## Consequences

Oxlint rules will work natively and correctly. Tests will be a little less ergonomic.

We can revisit this when oxlint start supporting fixtures properly.
