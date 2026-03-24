# Abstracting 3rd parties

## Status

Accepted

## Context

We picked Clerk for auth and Drizzle/Postgres for db. However, we don't have much experience with these technologies.

So far, they've been good, but we don't want to couple our code too much with these libs, in case they're not that great.

## Decision

Only the dedicated AuthService should use Clerk directly.

Only the dedicated Repository classes should use Drizzle directly.

## Consequences

This decouples the codebase from the libs. It also makes tests easier to set up, because we can swap those dependencies.

However, it does mean we'll have to write a bit more boilerplate, probably.
