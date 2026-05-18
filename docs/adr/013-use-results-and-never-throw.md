# Use Result And Never Throw

## Status

Accepted

## Context

Throwing errors in TypeScript is pretty weak because you don't have any type information about the errors you catch.

Moreover, you don't have type information about the error that could be thrown, so you don't know if you should be try/catching.

## Decision

Use the Result type to return Success or Failures. Wrap all third party that could throw in a Result.tryCatch to make sure the function doesn't throw by accident.

The only throwing allowed is throwing fatal errors with the intent to crash the app. These errors should never be caught.

## Consequences

The code will be more verbose, but also more explicit about error handling.

Errors will be fully type safe. There should be no try/catching to do on our own code, only on 3rd parties.
