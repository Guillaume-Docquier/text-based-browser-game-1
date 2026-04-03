# TRPC Return Types

## Status

Accepted

## Context

TRPC encourages defining everything in the global scope. However, that's against how we want to structure our code.

This is how you can get the types of your api inferred.

However, we don't want to create routers in the global scope. (see [No import side effects and arguments based DI](./008-no-import-side-effects-and-arguments-based-di.md)).

## Decision

Have the best of both worlds, we have to do the following pattern:

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

It's a bit of boilerplate and eslint noise, but only for trpc related things, which should only live at the api boundary.
