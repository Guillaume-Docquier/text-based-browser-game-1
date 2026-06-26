# Backend Drive Db Migrations

## Status

Accepted

Supersedes [003-manual-db-migrations](./003-manual-db-migrations.md)

## Context

Migrations used to be done manually before deploying the backend, but that didn't scale well.

## Decision

The Drizzle migrations are now applied by the backend on boot. This works well because we have a single backend and a single db schema.

## Consequences

Deployments are fully automated. However, if we start having multiple services accessing the database, deployments will need to be sequenced correctly.
