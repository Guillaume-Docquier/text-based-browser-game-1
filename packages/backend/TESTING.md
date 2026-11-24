# Backend tests

Use integration tests for backend behavior. Reserve concurrency tests for behavior that depends on synchronization between database sessions. The separate `types` project checks TypeScript contracts at compile time.

## Integration tests

Exercise the production entry point with an in-memory PGlite database. For [API slices](src/api/TESTING.md), a tRPC client sends HTTP requests through input validation, the use case, the production repository, and output validation. For [Turn Processing](src/turn-processing/TESTING.md), exercise the worker and observe its effect on the game. Tests written at these boundaries continue to work when the implementation changes.

Database and server setup has a cost. One test can follow a sequence of related actions and check the observable results along the way. Give independent behaviors separate tests so failures identify the affected scenario.

Use explicit `// Arrange`, `// Act`, and `// Assert` sections in that order. Use `// Act & Assert` for a synchronous call that throws or when splitting a complex sequence would make it harder to follow. Keep setup straightforward, write expected values explicitly, compare semantic values where possible, and sort unordered collections before comparing them.

Run the suite with `pnpm --filter backend test --project integration`.

## Concurrency tests

Use PostgreSQL through Testcontainers when an important outcome depends on the order of competing operations, such as two workers claiming the same Turn. These tests cost more to run and depend on the database operations used to create contention.

Use [PostgresConcurrency](src/testing/PostgresConcurrency.ts) to hold a row or table lock, observe that the intended operation is blocked, and release it at the point the scenario requires. Check the outcome of each competing operation and the final observable state. Sending requests at the same time alone cannot establish which operation waited. Only concurrency tests and the test harness may access database tables directly. See [ADR-016](../../docs/architecture/decisions/016-use-repositories-in-tests.md) and [ADR-026](../../docs/architecture/decisions/026-use-game-rows-as-concurrency-locks.md).

Run the suite with `pnpm --filter backend test --project concurrency`.

## Updating snapshots

Update a snapshot when a deliberate behavior change alters the expected result. For the seeded galaxy returned by the API, check the changed player-visible data. If the layout changed, render it with the test's seed and settings and inspect the map. Investigate an unexpected difference before accepting it.

To update the API snapshot, run `pnpm --filter backend test --project integration games.router.integration.test.ts --update`. Review the snapshot diff and rerun the test without `--update`. The [shared testing guide](../shared/TESTING.md#generator-snapshots) gives the preview and update commands for the spiral points and galaxy generator snapshots.
