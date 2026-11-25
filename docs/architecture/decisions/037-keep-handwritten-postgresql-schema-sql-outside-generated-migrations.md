# Keep handwritten PostgreSQL schema SQL outside generated migrations

## Status

Accepted

## Context

Drizzle generates migrations from the TypeScript schema. Some PostgreSQL objects, such as trigger functions and triggers, require handwritten SQL. The database must be able to rebuild those objects after the generated migration directory is deleted. Existing databases also need to apply new migrations in order while keeping the data they already contain.

## Decision

Keep SQL required on every fresh database under `packages/backend/migrations/` when Drizzle cannot generate it from the TypeScript schema. Apply these files in filename order after the initial generated schema on a fresh rebuild.

Keep the generated Drizzle migrations and journal in Git for deployment. Append generated entries for new handwritten files during normal development. Preserve the SQL and identity of migrations already in the deployment history. The backend applies that history at startup as described in [ADR-025](./025-backend-initiated-db-migrations.md).

## Consequences

A fresh database can be rebuilt from the TypeScript schema and the handwritten SQL sources. CI checks that the generated migrations are in sync. A handwritten migration must work after the current schema is generated, so changes to that schema must account for how it affects the handwritten SQL still used during a rebuild.
