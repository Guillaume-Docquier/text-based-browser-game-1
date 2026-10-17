# Use Result And Never Throw

## Status

Accepted

### Amendment history

- 2026-06-20: Clarified when a function should return a plain value instead of a `Result`.
- 2026-09-02: Clarified when repositories don't need to wrap db calls in `Result.tryCatch`.
- 2026-10-17: Clarified operation-specific rollback errors and their conversion to `Result` after rollback, matching the existing transaction boundary.

## Context

Throwing errors in TypeScript is pretty weak because you don't have any type information about the errors you catch.

Moreover, you don't have type information about the error that could be thrown, so you don't know if you should be try/catching.

## Decision

Use the Result type to return Success or Failures. Wrap all third party that could throw in a `Result.tryCatch` to make sure the function doesn't throw by accident.

Repository methods that explicitly require a transaction as argument don't need to wrap db calls in a `Result.tryCatch`. Returning a Failure here is useless boilerplate when we want to rollback the transaction anyway.

Use `Result` only when an operation has an expected failure that its caller must handle. Predicates, infallible transformations, and other operations without a failure payload return plain values such as `boolean`.

The only throwing allowed is fatal errors with the intent to crash the app, or operation-specific subclasses of `TransactionRollbackError` inside database transactions. Fatal errors should never be caught. API use cases define their rollback subclass in the companion `*.error.ts` module, as described in [ADR-033](./033-router-use-case-repository.md#use-case).

Do not return `Result.Failure` from a transaction callback or catch a rollback error there. Let the error escape so Drizzle rolls back. Wrap the entire transaction promise in `Result.tryCatch`, as [createCreateTransaction](../../../apps/backend/src/lib/db/createDb.ts) does. After the transaction has rejected and rollback has completed, the use case may convert the resulting typed rollback error to its operation's `Result.Failure`.

For example, [UpdateActionSubmissionRollbackError](../../../apps/backend/src/api/gameplay/updateActionSubmission.error.ts) is defined in the operation's error module. [UpdateActionSubmissionUseCase](../../../apps/backend/src/api/gameplay/updateActionSubmission.useCase.ts) imports that subclass, throws it inside the transaction callback, then maps its `code` to `Result.Failure` after awaiting `createTransaction`.

## Consequences

The code will be more verbose, but also more explicit about error handling.

Errors will be fully type safe. There should be no try/catching to do on our own code, only on 3rd parties via `Result.tryCatch`.
