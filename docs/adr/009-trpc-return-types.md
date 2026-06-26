# TRPC Return Types

## Status

Accepted

### Amendment history

- 2026-06-25: Updated to mention Tanstack Router

## Context

TRPC and Tanstack Router encourage defining everything in the global scope. However, that's against how we want to structure our code.

They do it like this because they leverage inference to get the types of the router inferred.

However, we don't want to create routers in the global scope. (see [No import side effects and arguments based DI](./008-no-import-side-effects-and-arguments-based-di.md)).

## Decision

To have the best of both worlds, we have to do the following pattern:

```ts
export type TrpcRouter = ReturnType<typeof createTrpcRouter>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let trpc inference do the work
function createTrpcRouter() {
  const trpc = createTrpc()

  return trpc.t.router({
    games: createGamesRouter({ ...trpc, gamesController, authService, logger }),
  })
}

type AppRouter = ReturnType<typeof createAppRouter>
// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tanstack inference do the work
function createAppRouter({ auth }: RouterContext) {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    context: {
      auth,
    },
  })
}
```

## Consequences

It's a bit of boilerplate and eslint noise, but only for trpc/tanstack router related things, which should only live at the boundary of the system and shouldn't change after being set up.
