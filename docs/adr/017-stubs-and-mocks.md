# Stubs And Mocks In Tests

## Status

Accepted

## Context

Tests need both data builders and dependency replacements. Mixing these concerns makes tests noisy, brittle, and less trustworthy.

## Decision

Use two explicit patterns:

1. **Stubs** = test data builders.
   - Signature: `create<Something>Stub(overrides?: Partial<Something>): <Something>`
   - File naming: `<Something>.stub.ts`
   - Provide realistic valid defaults; override only relevant fields per test.

2. **Mocks** = alternate dependency implementations.
   - File naming: `<Something>.mock.ts`
   - Use only when behavior must be controlled/observed and real implementation is unsuitable.
   - Prefer real implementations by default; mocks should be rarer than stubs.

## Consequences

Clearer test intent and naming consistency.

Less fragility from model changes via centralized stub defaults.

Higher confidence by defaulting to real implementations.
