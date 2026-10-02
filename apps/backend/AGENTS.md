# Backend Instructions

These instructions apply to the backend API, shared backend code, and Turn Processing.

## Architecture

The API uses Express, tRPC, Drizzle, Postgres, Clerk auth, Vitest, and PGlite for in-memory integration tests.

| Directory             | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `src/api`             | API vertical slices organized as router-controller/useCase-repository.  |
| `src/lib`             | Code shared by the API and Turn Processing, including database schemas. |
| `src/turn-processing` | Turn Processing worker and orchestration hosted by the API process.     |

There is no backend build. Node 26+ runs TypeScript natively, so code requires isolated modules and cannot use features such as enums or decorators.

Turn Processing is isolated so workers can scale independently or move to another runtime later. Turn Processing must not depend on the API.

## Commands

- `pnpm --filter backend test --project unit`: runs fast in memory unit tests without a database.
- `pnpm --filter backend test --project integration`: runs medium integration tests through the backend api with a PGLite database.
- `pnpm --filter backend test --project concurrency`: runs slow concurrency tests with a real PostgreSQL database through Testcontainers.
- `pnpm --filter backend db:generate --name <descriptive-migration-name>`: create a Drizzle migration. Always pass `--name`.

On Windows with Codex, `CodexSandboxOffline` cannot access the Docker daemon pipe. Run `pnpm --filter backend test --project concurrency` with `exec_command` and `sandbox_permissions: "require_escalated"`. This uses the normal Docker-enabled account, not administrator elevation.

## Testing

### API slice testing boundary

- The router is the strict testing boundary for API vertical slices. Exercise each slice through the API client, covering the real router, controller/use case, and production repository together.
- Never write repository tests or controller/use-case tests for these slices.
- Never implement test repositories, including repositories that insert or modify game state solely for test setup.
- Integration tests must set up and observe game state through the API. Create and start games with the test client, then submit actions and process turns to reach the required state. Use the stable test ruleset and a fixed galaxy seed for deterministic scenarios.
- This router-only boundary takes precedence over the repository-testing guidance in [ADR 016](../../docs/architecture/decisions/016-use-repositories-in-tests.md) for backend API slices.

### General testing guidelines

- Test production code. Do not use `vitest.mock()`.
- Prefer integration tests. Use unit tests sparingly for complex algorithms, race-condition validation, and regressions.
- Structure unit and integration tests using Arrange, Act, Assert, with explicit `// Arrange`, `// Act`, and `// Assert` sections in that order. `// Act & Assert` is acceptable for synchronous calls that throw and for genuinely complex routines where splitting the phases would make the test harder to understand.
- Optimize assertions for useful failure output: compare semantic values instead of opaque IDs, sort unordered collections before comparison, and keep setup control flow straightforward.
- Create expected state explicitly. Do not reimplement production logic in tests to compute expected results.
- Do not use `try`/`finally` for test cleanup. Prefer Explicit Resource Management with `using` or `await using` and resources that implement `Symbol.dispose` or `Symbol.asyncDispose` or use `afterEach` when disposal is not available or adds too much complexity.

## Drizzle Gotchas

- Do not call `tx.rollback()`. It throws at runtime, but TypeScript does not know that, so it breaks control-flow narrowing. `throw new TransactionRollbackError(...)` instead.
- Do not return results from transactions. Throw `TransactionRollbackError` to abort the transaction, or return the value directly.
- Do not add `runInTransaction` helpers or flatten nested transaction calls. Drizzle supports nested transactions. If a method must run inside an existing transaction, type its argument as a transaction; otherwise let it create a transaction for its own unit of work.
