# Snake Case Column Names

## Status

Accepted

## Context

The standard naming convention for columns with postgres is `snake_case` and there are known quirks when using `camelCase` because postgres is case-insensitive.

Drizzle handles column renaming as part of their schema definitions.

## Decision

All column definitions should use `camelCase` name for the TS side.
All column definitions should pass the `name` argument (even if no rename is needed) and rename the column as snake case for postgres.

## Consequences

The code will be a bit more verbose, but is localized the the schema definitions.
