# Router - Controller - Repository

## Status

Accepted

### Amendment history

- 2026-05-14: Clarified ownership for Zod schemas and naming conventions for DTOs and repository/database types.

## Context

Backend needs structure. We have many technologies in play (api, persistence and business logic) and if we're not careful, we'll be coupling everything.

We're not even sure of our choices, because we don't have a lot of experience with most of these techs.

## Decision

We'll make sure to decouple each layer, with:

- Routers: api layer, the only place that knows about express/trpc.
- Repositories: persistence layer, the only place that knows about drizzle/postgres.
- Controllers: business logic that bridge routers and repositories.

Repositories represent data access patterns (aka queries) and are not restricted to accessing single tables (think, joins).

### Schema ownership and naming

- Repositories never own Zod schemas. Repositories do not validate user input and should focus on persistence concerns.
- At the architecture boundary, routers could own request validation schemas. In practice for this codebase, controllers own Zod schemas because it is more practical while keeping responsibilities clear.
- Controller-owned Zod schemas and related types should be named with the `Dto` suffix (for example: `StarSystemDto`).

Repository and database types should follow these naming conventions:

- Repository creation input types use the `New` prefix (for example: `NewStarSystem`).
- Repository query result types use the `ReadModel` suffix (for example: `StarSystemReadModel`).
- Internal database query row shapes use the `Row` suffix (for example: `StarSystemRow`).
- `Row` types are internal repository implementation details and must never be exported. This keeps database architecture decoupled from the rest of the application.

## Consequences

When the business logic is low, controllers might look like unnecessary boilerplate.

If we ever need to changes tech, like replace express or drizzle, the blast radius should be limited to their layers and not affect the others.
