# Router - Use Case - Repository

## Status

Superseded by [ADR-033](./033-router-use-case-repository.md).

### Amendment history

- 2026-05-14: Clarified ownership for Zod schemas and naming conventions for DTOs and repository/database types.
- 2026-06-04: Updated naming conventions for repository/database types.
- 2026-06-13: Updated controller/repository responsibilities
- 2026-09-26: Incrementally migrating towards operation-specific use cases instead of controllers.
- 2026-10-07: Completed the controller migration to operation-specific use cases while retaining shared repositories.
- 2026-10-14: Colocated Query/Command schemas with their use cases and separated client input from server-authoritative execution values to make ownership explicit.
- 2026-10-16: Superseded by ADR-033, the evolution of the Router - Controller - Repository structure.

## Context

Backend needs structure. We have many technologies in play (api, persistence and business logic) and if we're not careful, we'll be coupling everything.

We're not even sure of our choices, because we don't have a lot of experience with most of these techs.

## Decision

We'll make sure to decouple each layer, with:

- Routers: api layer, the only place that knows about express/trpc.
- Repositories: persistence layer, the only place that knows about drizzle/postgres.
- Use cases: operation-specific business logic that bridge routers and repositories.

Repositories represent data access patterns (aka queries) and are not restricted to accessing single tables (think, joins).
Use cases decide what to store, Repositories know how to store.
Each use case is a class with constructor-injected dependencies and an `execute` method. Routers call use cases directly. Use cases can share the current repository instances; splitting use cases does not require splitting repositories.

Use cases can have access to a `tx` object through `createTransaction` but should only pass it to repositories, never use it to query/write to db. This abstraction leakage is because of how Drizzle deals with transactions, we can't hide them.

### Schema ownership and naming

- Repositories never own Zod schemas. Repositories do not validate user input and should focus on persistence concerns.
- Each use case with client input owns its schema in a sibling `<useCase>.query.ts` or `<useCase>.command.ts` file. Queries read data; commands change state. Export `<UseCase>QuerySchema` / `<UseCase>CommandSchema` and infer the corresponding `<UseCase>Query` / `<UseCase>Command` type with `z.infer`.
- When client input is present, the first `execute` argument is the parsed query or command. The second argument contains server-authoritative values such as authenticated `accountId` or membership-derived `playerId`; these values must not be part of the client input schema. Omit the second argument when no server values are needed.
- Queries and commands without client input use the explicit `NO_INPUT` schema in the router and have no dedicated Query/Command schema or ignored `execute` argument. Pass server-authoritative values as the only argument when needed; otherwise call `execute()` without arguments. Routers validate client input against the use case's schema directly when one exists.
- Response schemas and reusable nested transport shapes retain the `Dto` suffix (for example: `StarSystemDto`). DTOs reused by multiple use cases live in dedicated DTO modules.

Repository and database types should follow these naming conventions:

- Repository exposes `Model` suffixed types. (for example: `CreateLobbyModel`, `GameModel`).
- Internal database query row shapes use the `Row` suffix (for example: `GameRow`).
- `Row` types are internal repository implementation details and must never be exported. This keeps database architecture decoupled from the rest of the application.

## Consequences

When the business logic is low, use cases might look like unnecessary boilerplate.

Many use cases is more boilerplate than a single controller, but it makes the use case implementation more manageable for complex operations. Query/Command modules add small files, but give each input a discoverable owner and prevent authenticated identity from being mixed into client input.

If we ever need to changes tech, like replace express or drizzle, the blast radius should be limited to their layers and not affect the others.
