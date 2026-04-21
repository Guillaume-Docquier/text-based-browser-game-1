# Manual Production Database Management

## Status

Accepted

## Context

We've deployed the DB to Railway. We have a script to run db migrations. We have a script to do the initial db seed.

But we don't know how to automatically run migrations in Railway. Should we do it as a pre-deploy command of the backend? Maybe.

## Decision

For now we'll manage the migrations manually. We can use the same scripts we use locally, but with an env var.

We'll learn how to properly do this as we go.

## Consequences

I'll probably hit the production DB when I meant to affect the local db.
