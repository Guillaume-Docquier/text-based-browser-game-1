# Use Result And Never Throw

## Status

Accepted

### Amendment history

- 2026-06-20: Clarified when a function should return a plain value instead of a `Result`.
- 2026-09-02: Clarified when repositories don't need to wrap db calls in `Result.tryCatch`.

## Context

Throwing errors in TypeScript is pretty weak because you don't have any type information about the errors you catch.

Moreover, you don't have type information about the error that could be thrown, so you don't know if you should be try/catching.

## Decision

Use the Result type to return Success or Failures. Wrap all third party that could throw in a `Result.tryCatch` to make sure the function doesn't throw by accident.

Repository methods that explicitly require a transaction as argument don't need to wrap db calls in a `Result.tryCatch`. Returning a Failure here is useless boilerplate when we want to rollback the transaction anyway.

Use `Result` only when an operation has an expected failure that its caller must handle. Predicates, infallible transformations, and other operations without a failure payload return plain values such as `boolean`.

The only throwing allowed is throwing fatal errors with the intent to crash the app, or the special TransactionRollBackError inside db transactions. These errors should never be caught.

## Consequences

The code will be more verbose, but also more explicit about error handling.

Errors will be fully type safe. There should be no try/catching to do on our own code, only on 3rd parties via `Result.tryCatch`.
