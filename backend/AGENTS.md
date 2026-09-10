# Backend Instructions

These instructions apply to the backend API, shared backend code, and Turn Processing.

## Architecture

The API uses Express, tRPC, Drizzle, Postgres, Clerk auth, Vitest, and PGlite for in-memory integration tests.

| Directory             | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `src/api`             | API vertical slices organized as router-controller-repository.          |
| `src/lib`             | Code shared by the API and Turn Processing, including database schemas. |
| `src/turn-processing` | Turn Processing worker and orchestration hosted by the API process.     |

There is no backend build. Node 26+ runs TypeScript natively, so code requires isolated modules and cannot use features such as enums or decorators.

Turn Processing is isolated so workers can scale independently or move to another runtime later. Turn Processing must not depend on the API.

## Commands

- `pnpm --filter backend test`: run all backend tests.
- `pnpm --filter backend checks`: run all backend quality checks.
- `pnpm --filter backend db:generate --name <descriptive-migration-name>`: create a Drizzle migration. Always pass `--name`.

## Testing

- Test production code. Do not use `vitest.mock()`.
- Prefer integration tests. Use unit tests sparingly for complex algorithms, race-condition validation, and regressions.
- Structure unit and integration tests using Arrange, Act, Assert, with explicit `// Arrange`, `// Act`, and `// Assert` sections in that order.
- Optimize assertions for useful failure output: compare semantic values instead of opaque IDs, sort unordered collections before comparison, and keep setup control flow straightforward.
- Create expected state explicitly. Do not reimplement production logic in tests to compute expected results.

## Drizzle Gotchas

- Do not call `tx.rollback()`. It throws at runtime, but TypeScript does not know that, so it breaks control-flow narrowing. Throw `new TransactionRollbackError(...)` from `src/lib/errors.ts` instead.
- Do not return results from transactions. Throw `TransactionRollbackError` to abort the transaction, or return the value directly.
- Do not add `runInTransaction` helpers or flatten nested transaction calls. Drizzle supports nested transactions. If a method must run inside an existing transaction, type its argument as a transaction; otherwise let it create a transaction for its own unit of work.
