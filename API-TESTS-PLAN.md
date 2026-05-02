# API Test Setup Plan

## Summary

Set up backend API tests with Vitest 4, using `createApi` to build the Express/tRPC app, `@trpc/client` to call the API over HTTP, Drizzle's `drizzle.mock({ schema })` mock driver for the DB, and a new `AuthServiceMock` that controls `req.player`.

Do not create shared test utility/helper files or folders. Keep the demonstration setup local to the test file.

## Key Changes

- Add backend dev dependencies:
  - `vitest@^4`
  - `@trpc/client` matching the existing `@trpc/server` version
- Add backend scripts:
  - `test`: `vitest run`
  - `test:watch`: `vitest`
- Add `backend/vitest.config.ts` with Node environment, no globals, and test include matching `src/**/*.test.ts`.
- Keep tests under `backend/src/**` so the existing `backend/tsconfig.json` include covers them.
- Edit `AGENTS.md` to add the rule: do not create shared test utility/helper files or folders unless explicitly requested; keep test setup local until reuse is proven.

## Implementation Changes

- Create `backend/src/api/auth/auth.service.mock.ts`.
  - Export `AuthServiceMock`.
  - Implement the public API shape of `AuthService`: `authenticationMiddlewares({ playersController }): RequestHandler[]`.
  - Store `currentPlayer: Player | undefined`.
  - Provide methods such as `authenticateAs(player: Player): void`, `clearAuthentication(): void`, and `setCurrentPlayer(player: Player | undefined): void`.
  - Middleware should set `req.player = currentPlayer` when present, or leave it `undefined` for anonymous requests.
  - Do not import Clerk.

- Add `backend/src/api/games/games.router.test.ts`.
  - Put all test-only setup directly in this file.
  - Use `Logger.get()` for the injected logger; do not create a mock logger.
  - Create the DB with `drizzle.mock({ schema })` from `drizzle-orm/node-postgres`.
  - Patch the mock DB session client in the test file with a deterministic `query` function that records SQL/params and returns queued `{ rows }` responses.
  - Instantiate real repositories with the mock DB, pass them plus `AuthServiceMock` into `createApi`, and call the API with a real tRPC HTTP client.
  - Start the returned Express app on port `0`, create a client with `createTRPCClient<TrpcRouter>` and `httpBatchLink({ url: baseUrl + "/trpc" })`, and close the server in teardown.
  - Do not create `api.testUtils.ts`, test helpers folders, or any shared test utility module.

## Test Cases

- `games.create` authenticated happy path:
  - Authenticate as a mock `Player`.
  - Queue Drizzle mock responses for the transaction: `begin`, game insert returning one row, savepoint, summary-by-id select, game-player insert, release savepoint, commit.
  - Call `client.games.create.mutate({ newGame: { name, nbSeats, tickIntervalSeconds } })`.
  - Assert the returned `newGame` includes the mock DB row and `createdByPlayerId` from the authenticated player.
  - Assert recorded insert params include `name`, authenticated `player.id`, `nbSeats`, and `tickIntervalSeconds`.

- `games.create` anonymous request:
  - Clear authentication.
  - Call `client.games.create.mutate(...)`.
  - Assert tRPC returns `UNAUTHORIZED`.
  - Assert no DB queries were executed.

- `games.getSummaries` anonymous request:
  - Queue joined select rows for one waiting game with a creator.
  - Call `client.games.getSummaries.query()`.
  - Assert response has one game with `status: "WAITING_FOR_PLAYERS"` and all capability flags false.

- `games.getSummaries` authenticated request:
  - Authenticate as a player who is not in the game.
  - Queue joined select rows for a waiting game.
  - Assert `canJoin: true`, `canLeave: false`, `canStart: false`.

## Verification

- Run `pnpm --dir backend test`.
- Run `pnpm --dir backend typecheck`.
- Run `pnpm lint`.
- If package files change, run `pnpm format:package-json`.

## Assumptions

- Use Vitest's default Node test environment.
- Use tRPC's vanilla HTTP client rather than router callers, because the goal is to demonstrate API-client testing through `createApi`.
- Drizzle's mock driver creates the typed database/session, but tests still provide queued mock `query` results for repository calls.
- HTTP tRPC responses serialize `Date` values as strings; assertions should compare ISO strings at the client boundary.
