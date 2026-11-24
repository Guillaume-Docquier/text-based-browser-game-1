# Test backend behavior through production entry points

## Status

Accepted

### Amendment history

- 2026-11-16: Allow concurrency tests to use the database directly. Remove mentions of repository tests.
- 2026-11-23: Limit direct controller or repository setup to Turn Processing preconditions the API cannot establish. This keeps API scenarios reachable through the public contract.

## Context

Some backend tests directly read, insert, or update rows with Drizzle table access. This couples tests to schema details and bypasses repository APIs that encode domain behavior and error handling.

The API and the Turn Processing worker have different entry points. A worker can encounter a scheduling condition that a player cannot create through the API.

Concurrency tests need control over when competing operations reach their critical database reads and writes. Starting many API requests together does not establish a particular schedule. Checking only final state can also hide unexpected API failures, such as uniqueness violations caused by missing locks. PGlite integration tests cannot verify PostgreSQL row locking or `SKIP LOCKED`.

## Decision

Exercise API behavior through the public API, including setup and observation of game state. Exercise Turn Processing through the worker. Use the API for worker setup whenever possible. Only worker tests may call a production controller or repository to establish a precondition the API cannot create. Do not add endpoints solely for test setup.

Only concurrency tests and the test harness may access database tables directly.

Concurrency tests use real PostgreSQL and can use the database directly to acquire a temporary lock to pause an operation at a known database boundary in order to guarantee that the concurrency race under test happens. Concurrency tests should still prefer going through the API whenever possible.

## Consequences

Tests are less coupled to the database schema and easier to refactor.

API scenarios cover the production repository while remaining stable across changes to the internal call structure.

Concurrency cases now prove that the intended contention occurred and reject unexpected errors even when final state is valid.

Scheduling infrastructure depends on table names, statement kinds, and the lock design. Schema or transaction changes can require updates to that infrastructure.
