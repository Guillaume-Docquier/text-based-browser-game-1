# Database schema

Use camelCase for TypeScript column names. Pass the PostgreSQL snake_case name explicitly to Drizzle's column builder, including when both names are identical. See [ADR-021](../../../../../docs/architecture/decisions/021-snake-case-column-names.md).

Application code supplies business defaults when it creates rows. Retain primary keys, foreign keys, unique constraints and `NOT NULL`. The database supplies defaults for timestamps that capture the current time and for incrementing primary keys. UUID primary keys may also have defaults. Keep business validation such as numeric ranges in application code. See [ADR-029](../../../../../docs/architecture/decisions/029-application-supplied-business-defaults.md).
