# Result Handling In Tests

## Status

Accepted

## Context

Tests often call functions that return `Result` values.

During setup, these calls are usually only there to create prerequisite state. If setup cannot create that state, the test should fail immediately with a clear signal instead of continuing with missing or invalid data.

During verification, tests need useful failure output. Assertions such as `expect(Result.isSuccess(result)).toBe(true)` only prove the tag and hide the actual `Failure` payload when the expectation fails. They also usually miss the more important assertion: the exact success value.

## Decision

When a test setup call returns a `Result` and the test expects it to succeed, use the `extractSuccess` test helper:

```ts
const account = extractSuccess(await accountsRepository.createAccount(newAccount))
```

When verifying a `Result` with Vitest, compare the full `Result` object instead of asserting on `Result.isSuccess`:

```ts
expect(result).toEqual(Result.Success(expectedValue))
```

Do not use this pattern for setup:

```ts
expect(Result.isSuccess(result)).toBe(true)
```

## Consequences

Test setup stays concise and fails at the point where an expected success did not happen.

Result assertions become more useful because a failed expectation shows the full `Result`, including the `Failure` value.

Tests verify both the success tag and the returned value in one assertion.
