# Router - Controller - Repository

## Status

Accepted

## Context

Backend needs structure. We have many technologies in play (api, persistence and business logic) and if we're not careful, we'll be coupling everything.

We're not even sure of our choices, because we don't have a lot of experience with most of these techs.

## Decision

We'll make sure to decouple each layer, with:

- Routers: api layer, the only place that knows about express/trpc.
- Repositories: persistence layer, the only place that knows about drizzle/postgres.
- Controllers: business logic that bridge routers and repositories.

Repositories represent data access patterns (aka queries) and are not restricted to accessing single tables (think, joins).

## Consequences

When the business logic is low, controllers might look like unnecessary boilerplate.

If we ever need to changes tech, like replace express or drizzle, the blast radius should be limited to their layers and not affect the others.
