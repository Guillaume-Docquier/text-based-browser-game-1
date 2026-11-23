# Backend tests

- `pnpm --filter backend test --project unit`: runs in-memory unit tests without a database.
- `pnpm --filter backend test --project integration`: runs API integration tests with PGlite.
- `pnpm --filter backend test --project concurrency`: runs concurrency tests with PostgreSQL through Testcontainers.

Only concurrency tests and the test harness may access database tables directly. For concurrency tests, use real PostgreSQL and acquire temporary locks to establish the race under test. See [ADR-016](../../docs/architecture/decisions/016-use-repositories-in-tests.md) and [ADR-026](../../docs/architecture/decisions/026-use-game-rows-as-concurrency-locks.md).
