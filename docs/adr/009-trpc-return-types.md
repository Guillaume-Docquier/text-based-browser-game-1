# TRPC Return Types

## Status

Accepted

## Context

tRPC type inference often assumes routers are declared in global scope. Our architecture forbids global stateful construction.

## Decision

Keep routers in factory functions and export inferred type from that factory:

```ts
export type TrpcRouter = ReturnType<typeof createTrpcRouter>
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let trpc inference do the work
function createTrpcRouter() {
  const trpc = createTrpc()

  return trpc.t.router({
    games: createGamesRouter({ ...trpc, gamesController, authService, logger }),
  })
}
```

## Consequences

Adds small tRPC-specific boilerplate and lint exceptions at the API boundary.
