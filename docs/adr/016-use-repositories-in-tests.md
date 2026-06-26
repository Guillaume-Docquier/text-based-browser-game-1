# Use Repositories In Tests

## Status

Accepted

## Context

Some backend tests directly read, insert, or update rows with Drizzle table access. This couples tests to schema details and bypasses repository APIs that encode domain behavior and error handling.

Repository tests are the exception: they can assert directly on database state because the database is their direct dependency.

## Decision

Backend tests should prefer using repositories over the database. Only repository tests should use the database.

## Consequences

Tests are less coupled to the database schema and easier to refactor.

We'll get better test coverage of repositories.

In most cases this should not even be a concern, because we favor integration tests through the API.
