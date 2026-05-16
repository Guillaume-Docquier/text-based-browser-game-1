# Stubs And Mocks In Tests

## Status

Accepted

## Context

Tests need two distinct kinds of test doubles:

- test data builders for domain objects;
- alternate implementations of production dependencies.

When tests build large objects inline, they become noisy and brittle. Small model changes force widespread test edits even when changed fields are irrelevant to the behavior under test.

At the same time, replacing production implementations too aggressively with fake implementations reduces confidence and can hide integration issues.

We need a clear distinction between stubs and mocks, with naming and usage rules that keep tests maintainable while preserving confidence in real behavior.

## Decision

We standardize these two patterns:

1. **Stubs** are test data builders.
   - Use the shape `create<Something>Stub(overrides?: Partial<Something>): <Something>`.
   - Place them in `<Something>.stub.ts` files.
   - Default values should produce valid, realistic objects.
   - Tests pass only relevant differences via `overrides`.

2. **Mocks** are alternate implementations of production classes/services.
   - Place them in `<Something>.mock.ts` files.
   - Use them only when a test must control or observe dependency behavior that cannot be exercised reliably with the real implementation.
   - Prefer testing with real implementations by default; mocks are expected to be rarer than stubs.

## Consequences

Tests become easier to read because intent is explicit:

- object setup uses stubs;
- behavior replacement uses mocks.

Tests become less fragile to unrelated model changes, because stubs centralize default object creation.

The codebase gains consistent file naming and discoverability for test doubles.

By favoring real implementations and using mocks sparingly, we keep stronger confidence in production behavior while still enabling focused unit tests when isolation is necessary.
