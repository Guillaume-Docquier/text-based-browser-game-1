# Application-Supplied Business Defaults

## Status

Proposed

## Context

Database defaults can hide which values an application deliberately chose when it creates a row. That makes creation behavior harder to review and can allow a schema change to silently alter application behavior. Database defaults are still useful for values that the database naturally owns, such as creation timestamps and generated UUIDs.

The project has no users whose data must be preserved during early schema changes, so new schema work can be introduced with a clean development database. This decision is about the direction for new and changed schema declarations; it does not require an unrelated cleanup of existing defaults.

## Decision

Application code supplies business defaults explicitly when creating rows.

- Database defaults are generally limited to timestamps.
- Generated UUID defaults are a tolerated exception, including generated primary-key UUIDs.
- Do not add database defaults for booleans, strings, enums, or mandatory IDs. Inserts must provide those values explicitly.
- Keep structural database constraints such as primary keys, foreign keys, unique constraints, and `NOT NULL` constraints.
- Avoid advanced database business checks, such as numeric ranges, unless a future decision explicitly justifies one.

## Consequences

Row creation is explicit at the application boundary, making business behavior easier to review and test. The database continues to protect relational integrity and identity uniqueness, while timestamps and generated UUIDs retain database-owned generation where it is useful.

New callers must provide values that were previously supplied by schema defaults, and existing defaults may remain until the affected table is intentionally migrated. Rich business validation stays in application/domain code rather than being duplicated in database checks.
