# Router - Controller - Repository

## Status

Accepted

### Amendment history

- 2026-05-14: Clarified ownership for Zod schemas and naming conventions for DTOs and repository/database types.

## Context

Backend needs strict layering to avoid coupling API, business logic, and persistence concerns.

## Decision

Use three layers:

- Routers: API boundary; only layer aware of Express/tRPC.
- Repositories: persistence boundary; only layer aware of Drizzle/Postgres.
- Controllers: business logic between routers and repositories.

Repositories model query/use-case access patterns and may span multiple tables.

### Schema ownership and naming

- Repositories never own Zod schemas.
- Routers may own input schemas at architecture boundaries.
- In this codebase, controllers own Zod schemas for practicality while preserving responsibilities.
- Controller schemas/types use `Dto` suffix (for example: `StarSystemDto`).

Repository/database naming:

- Creation input types: `New*` (for example: `NewStarSystem`).
- Repository result types: `*ReadModel` (for example: `StarSystemReadModel`).
- Internal database row shapes: `*Row` (for example: `StarSystemRow`).
- `Row` types are internal repository details and must not be exported.

## Consequences

May add boilerplate when business logic is simple.

Limits blast radius when replacing framework or persistence technology.
