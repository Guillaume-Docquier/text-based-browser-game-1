# Never Throw

## Status

Accepted

## Context

Thrown errors in TypeScript are weakly typed, making error contracts and handling unclear.

## Decision

Model expected failures with `Result` (success/failure values).

Wrap third-party throwers with `Result.tryCatch`.

Only throw for unrecoverable, intentional process-fatal conditions.

## Consequences

More explicit and type-safe error flows, with some verbosity.

Application code should rarely require try/catch except at third-party boundaries.
