# Result Handling In Tests

## Status

Accepted

## Context

Tests often use `Result`-returning functions. Setup should fail fast on unexpected failures. Assertions should reveal full failure payloads, not only success tags.

## Decision

For setup calls expected to succeed, use `extractSuccess`:

```ts
const player = extractSuccess(await playersRepository.create(newPlayer))
```

For verification, assert full `Result` values:

```ts
expect(result).toEqual(Result.Success(expectedValue))
```

Do not use tag-only setup assertions such as:

```ts
expect(Result.isSuccess(result)).toBe(true)
```

## Consequences

Setup fails at the exact failing call.

Assertions are more informative and verify both tag and payload.
