# Router - Controller - Repository

## Status

Accepted

### Amendment history

- 2026-05-14: Clarified ownership for Zod schemas and naming conventions for DTOs and repository/database types.
- 2026-06-04: Updated naming conventions for repository/database types.
- 2026-06-13: Updated controller/repository responsibilities
- 2026-09-26: Incrementally migrating towards operation-specific use cases instead of controllers.

## Context

Backend needs structure. We have many technologies in play (api, persistence and business logic) and if we're not careful, we'll be coupling everything.

We're not even sure of our choices, because we don't have a lot of experience with most of these techs.

## Decision

We'll make sure to decouple each layer, with:

- Routers: api layer, the only place that knows about express/trpc.
- Repositories: persistence layer, the only place that knows about drizzle/postgres.
- Controllers (old): business logic that bridge routers and repositories.
- Use cases (new): operation-specific business logic that bridge routers and repositories.

Repositories represent data access patterns (aka queries) and are not restricted to accessing single tables (think, joins).
Controllers and use cases decide what to store, Repositories know how to store.
Use cases are more granular than controllers and allow for a better separation of concerns when controller methods became complex. They should be preferred over controllers.

Controllers and use cases can have access to a `tx` object through `createTransaction` but should only pass it to repositories, never use it to query/write to db. This abstraction leakage is because of how Drizzle deals with transactions, we can't hide them.

### Schema ownership and naming

- Repositories never own Zod schemas. Repositories do not validate user input and should focus on persistence concerns.
- At the architecture boundary, routers could own request validation schemas. In practice for this codebase, the controller or use case that handles the operation owns its Zod schemas because it is more practical while keeping responsibilities clear.
- Controller and use-case owned Zod schemas and related types should be named with the `Dto` suffix (for example: `StarSystemDto`).

Repository and database types should follow these naming conventions:

- Repository exposes `Model` suffixed types. (for example: `CreateLobbyModel`, `GameModel`).
- Internal database query row shapes use the `Row` suffix (for example: `GameRow`).
- `Row` types are internal repository implementation details and must never be exported. This keeps database architecture decoupled from the rest of the application.

## Consequences

When the business logic is low, controllers might look like unnecessary boilerplate.

Many use cases is more boilerplate than a single controller, but it makes the use case implementation more manageable for complex operations.

If we ever need to changes tech, like replace express or drizzle, the blast radius should be limited to their layers and not affect the others.
