# Use Repositories In Tests

## Status

Accepted

### Amendment history

- 2026-11-16: Allow PostgreSQL lock control and observation in concurrency test infrastructure. Require verified schedules and API outcomes because request bursts can pass without exercising the intended contention. Preserve the router boundary for API slices.

## Context

Some backend tests directly read, insert, or update rows with Drizzle table access. This couples tests to schema details and bypasses repository APIs that encode domain behavior and error handling.

Repository tests are the exception: they can assert directly on database state because the database is their direct dependency.

Concurrency tests need control over when competing operations reach their critical database reads and writes. Starting many API requests together does not establish a particular schedule. Checking only final state can also hide unexpected API failures, such as uniqueness violations caused by missing locks. PGlite integration tests cannot verify PostgreSQL row locking or `SKIP LOCKED`.

## Decision

Backend tests should prefer using repositories over the database. API slice tests must use the API client to exercise the router, use case, and production repository together, as required by the backend instructions. Set up and observe game state through the API. Turn Processing tests may invoke the production processor and its repositories.

Direct database access is permitted in repository tests and in test infrastructure for database creation, migrations, reference-data seeding, disposal, and concurrency scheduling. The scheduling exception does not permit inserting or changing game state directly, replacing production repositories, or using database queries for business assertions.

Concurrency tests use real PostgreSQL with production code. A separate connection acquires a temporary lock to pause an operation at a known database boundary. Before releasing it, the test must observe the required competing sessions, active statements, lock waits, and blockers using PostgreSQL system views and `pg_blocking_pids()`. Tests of `SKIP LOCKED` must show that another processor progresses or returns idle while the first claim remains uncommitted. Use independent connections and isolate each test's database so scheduling locks cannot affect other tests.

Each case must verify its schedule, each operation's result, and the resulting game state. Use a small number of actors and explicit operation orders. A polling timeout fails the schedule and reports database diagnostics; elapsed time alone never proves blocking. Release scheduling locks even when an assertion fails. Validate the tests with temporary removal of the relevant lock or `SKIP LOCKED`, then restore production code.

Prefer PostgreSQL-controlled scheduling over application checkpoints for these database races: it keeps the application unchanged. Application checkpoints provide more pause locations but introduce test scheduling interfaces into production code. Request bursts may supplement deterministic cases as stress tests, but cannot replace the schedule checks.

## Consequences

Tests are less coupled to the database schema and easier to refactor.

We'll get better test coverage of repositories.

In most cases this should not even be a concern, because we favor integration tests through the API.

Concurrency cases now prove that the intended contention occurred and reject unexpected errors even when final state is valid. Sharing a container per test worker reduces startup cost while separate databases preserve isolation.

Scheduling infrastructure depends on table names, statement kinds, and the lock design. Schema or transaction changes can require updates to that infrastructure. These tests cover their specified schedules, not every possible interleaving. PostgreSQL and Docker remain required for the concurrency suite.
