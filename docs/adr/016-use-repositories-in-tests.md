# Use Repositories In Tests

## Status

Accepted

## Context

Direct Drizzle table access in non-repository tests couples tests to schema internals and bypasses repository behavior.

## Decision

In backend tests, prefer repositories over direct database access.

Only repository tests should access the database directly.

## Consequences

Lower schema coupling and easier refactors.

Better coverage of repository behavior.
