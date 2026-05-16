# Use Assert For Runtime Invariants

## Status

Accepted

## Context

TypeScript types are not always enough to express what the code knows at runtime.

Third-party libraries can return loose or overly broad types. Some APIs also have runtime contracts that TypeScript cannot infer. For example, Drizzle insert methods return an array even when the code inserts a single row.

If we cast these values or silently assume a precondition, incorrect assumptions can produce confusing behavior later in the flow. We want those assumptions to be explicit and fail immediately when they are wrong.

## Decision

Use `Assert` to express runtime invariants and required preconditions in real code.

Prefer this:

```ts
const rows = await db.insert(playersTable).values(newPlayer).returning()

Assert.isTrue(rows.length === 1)
Assert.isDefined(rows[0])

return rows[0]
```

Instead of relying on casts, unchecked indexing, or comments that only describe an assumption:

```ts
const rows = await db.insert(playersTable).values(newPlayer).returning()

return rows[0] as PlayerRow
```

Assertions should be used for invariants that mean our understanding of the code, data, or dependency contract is wrong if they fail. They are not a replacement for expected error handling. Expected failures should still be represented with `Result`.

## Consequences

Runtime assumptions are visible in the code instead of being hidden in casts.

If a dependency behavior changes, or if our understanding of a precondition is wrong, the code fails immediately at the invariant instead of producing strange downstream behavior.

The code becomes slightly more verbose, but the added checks document important contracts and make failures easier to diagnose.
