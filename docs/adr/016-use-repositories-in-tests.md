# use-repositories-in-tests

## Status

Accepted

## Context

Some backend tests directly read, insert, or update rows with Drizzle table access. This couples tests to schema details and bypasses repository APIs that encode domain behavior and error handling. Repository tests are the exception: they can assert directly on database state because the database is their direct dependency.

## Decision

Backend tests should prefer repositories for reads and writes whenever a suitable repository API exists.

- Test helpers must use repositories instead of direct table writes when a repository exists.
- Direct db access in tests is still allowed when no appropriate repository API exists yet.
- If direct db access repeats, we should consider adding a small repository method rather than duplicating raw table logic in tests.

As part of this decision, tests now instantiate `PlayersRepository` directly when they need to create players.

## Consequences

- Tests are less coupled to schema and easier to refactor.
- Repository behavior gets additional exercise via integration tests.
- Some test setup may require a logger/repository instantiation, adding slight boilerplate.
