# Abstracting 3rd parties

## Status

Accepted

## Context

The project uses Clerk (auth) and Drizzle/Postgres (persistence). Tight coupling would raise migration and testing cost.

## Decision

Only AuthService may call Clerk directly.

Only Repository classes may call Drizzle directly.

## Consequences

Improves replaceability and testability through clear boundaries.

Adds some boilerplate at integration edges.
