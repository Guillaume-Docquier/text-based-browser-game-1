# Use Assert For Runtime Invariants

## Status

Accepted

## Context

Some runtime guarantees cannot be expressed by TypeScript or are looser in third-party API typings. Silent assumptions and casts hide these contracts.

## Decision

Use `Assert` for required runtime invariants/preconditions.

Prefer explicit checks over casts or unchecked indexing:

```ts
const rows = await db.insert(playersTable).values(newPlayer).returning()

Assert.isTrue(rows.length === 1)
Assert.isDefined(rows[0])

return rows[0]
```

Assertions are for invariant violations (unexpected states), not expected business failures. Expected failures must use `Result`.

## Consequences

Critical runtime assumptions are explicit and fail at the source.

Slightly more verbosity for better diagnosability and safer contracts.
