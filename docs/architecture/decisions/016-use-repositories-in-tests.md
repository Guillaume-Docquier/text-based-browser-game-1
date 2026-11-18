# Use Repositories In Tests

## Status

Accepted

### Amendment history

- 2026-11-16: Allow concurrency tests to use the database directly. Remove mentions of repository tests.

## Context

Some backend tests directly read, insert, or update rows with Drizzle table access. This couples tests to schema details and bypasses repository APIs that encode domain behavior and error handling.

Repository tests are the exception: they can assert directly on database state because the database is their direct dependency.

Concurrency tests need control over when competing operations reach their critical database reads and writes. Starting many API requests together does not establish a particular schedule. Checking only final state can also hide unexpected API failures, such as uniqueness violations caused by missing locks. PGlite integration tests cannot verify PostgreSQL row locking or `SKIP LOCKED`.

## Decision

Backend tests should use the routers, controllers or repositories (in that order), not the database tables directly. Only concurrency tests and the test harness can use the database directly.

Concurrency tests use real PostgreSQL and can use the database directly to acquire a temporary lock to pause an operation at a known database boundary in order to guarantee that the concurrency race under test happens. Concurrency tests should still prefer going through the API whenever possible.

## Consequences

Tests are less coupled to the database schema and easier to refactor.

We'll get better test coverage of repositories.

In most cases this should not even be a concern, because we favor integration tests through the API.

Concurrency cases now prove that the intended contention occurred and reject unexpected errors even when final state is valid.

Scheduling infrastructure depends on table names, statement kinds, and the lock design. Schema or transaction changes can require updates to that infrastructure.
