# Player Actions V1

## Summary

Add per-player, per-game action selection for active games with two actions: `MAKE_MORE_MONEY` and `WIN_THE_GAME`. Players choose at most one action for the upcoming tick from the play screen, can change it any time before processing starts, and their current selection persists across page refreshes. Tick processing resolves the selected action for the current tick without deleting historical action rows.

Chosen product rules for this plan:

- Ticks keep the existing passive `+1 money`.
- Action submission is rejected unless the player can already afford the action at submit time.
- Current selections are private to the current player only.
- Winning must persist the winner.

## Implementation Phases

### Phase 1: Data model and backend primitives

1. Add `winnerPlayerId` to `games` and add the append-only `game_player_actions` table keyed by `(gameId, playerId, tick)`.
2. Update Drizzle schema, inferred row types, and migration files for both schema changes.
3. Add backend action constants and types for:
   - action ids
   - action cost/reward rules
   - shared Zod schema for API output
4. Add repository methods to:
   - upsert one action for `(gameId, playerId, tick)`
   - fetch one action for `(gameId, playerId, tick)`
   - fetch all actions for `(gameId, tick)`

### Phase 2: API and business rules

1. Add a `gamePlayerActions` controller following the existing controller pattern.
2. In action submission, resolve the game’s current tick from `game_states`.
3. Enforce submission rules:
   - game exists
   - game is started
   - game is not ended
   - player belongs to the game
   - player can afford the selected action now
4. Add tRPC routes:
   - `getCurrent({ gameId })`
   - `setCurrent({ gameId, actionType })`
5. Register the router in `createApi.ts` and expose any required frontend API types.

### Phase 3: Tick resolution

1. Extend tick processing to fetch all actions for `(gameId, gameState.tick)` before resolving players.
2. Keep the existing passive `+1 money` income.
3. Resolve submitted actions for that tick:
   - `MAKE_MORE_MONEY`: `-2 money`, then `+5 money`
   - `WIN_THE_GAME`: `-10 money`, set `endedAt`, set `winnerPlayerId`
4. If a player wins:
   - finish the current tick
   - do not schedule the next tick
   - leave existing action rows untouched
5. If no player wins:
   - schedule the next tick as today
   - update `game_states` to the next tick
   - leave existing action rows untouched

### Phase 4: Frontend play screen

1. Extend `/play/$gameId` to fetch both the player game state and the current action for the current tick.
2. Add a basic action selection UI with two choices:
   - `Make More Money`
   - `Win The Game`
3. Show the currently selected action and its cost/effect.
4. Disable unavailable actions when the player lacks money and show an inline reason.
5. Submit selection changes through the new mutation and refresh the current-action query so refreshes remain consistent.
6. After tick advancement, show no current selection for the new tick until the player picks again.

### Phase 5: Verification

1. Run repository-level checks for append-only per-tick action behavior.
2. Run controller/router checks for membership, game lifecycle, and affordability rules.
3. Run tick-processing checks for normal income, action resolution, and win handling.
4. Run frontend manual verification on refresh persistence, selection changes, and post-tick empty state.

## Implementation Changes

### Data model

- Add a new `game_player_actions` table keyed by `(gameId, playerId, tick)` with:
  - `gameId`
  - `playerId`
  - `tick`
  - `actionType`
  - `createdAt`
  - `updatedAt`
- Treat this table as append-only history. A player’s current action is the row for the game’s current tick, and changing the action before processing updates that same `(gameId, playerId, tick)` row.
- Add a `winnerPlayerId` nullable FK on `games` so ended games can persist the winner.
- Keep action costs and rewards in backend constants, using the existing `as const` pattern:
  - `MAKE_MORE_MONEY`: cost `2 MONEY`, reward `5 MONEY`
  - `WIN_THE_GAME`: cost `10 MONEY`, ends the game, no resource reward
- Generate a migration for both schema changes and update Drizzle schema/types accordingly.
- Add a uniqueness guarantee via the primary key so each player has at most one action row per game tick.

### Backend API and business logic

- Add a dedicated player-actions backend slice following the existing router/controller/repository pattern.
- Repository responsibilities:
  - upsert the current player action for `(gameId, playerId, tick)`
  - fetch the current player action for `(gameId, playerId, tick)`
  - fetch all actions for `(gameId, tick)` during tick processing
- Controller responsibilities:
  - verify the game exists and is started but not ended
  - verify the player belongs to the game
  - resolve the game’s current tick from `game_states` and always submit against that tick
  - verify affordability at submission time using current resources
  - map DB rows to API types
- tRPC routes:
  - `gamePlayerActions.getCurrent({ gameId }) -> { action: GamePlayerAction | null }`
  - `gamePlayerActions.setCurrent({ gameId, actionType }) -> { action: GamePlayerAction }`
- Add the new router to `createApi.ts` and export any needed frontend API types.

### Tick processing

- Extend `processTick` to load all selected actions for `(gameId, gameState.tick)` before resolving players.
- Per player, resolve in this order:
  1. apply the existing passive `+1 MONEY`
  2. if no selected action, continue
  3. if selected action is `MAKE_MORE_MONEY`, subtract `2 MONEY` then add `5 MONEY`
  4. if selected action is `WIN_THE_GAME`, subtract `10 MONEY`, mark the game ended, and set `winnerPlayerId`
- Since submission already enforces affordability, tick processing can treat selected actions as executable invariants; if data is inconsistent, log and fail that tick rather than silently changing behavior.
- When a winning action succeeds:
  - update `games.endedAt` and `games.winnerPlayerId`
  - do not schedule another tick for that game
  - still mark the current tick as finished
- For non-winning ticks:
  - preserve current next-tick scheduling/state update behavior
  - do not delete or clear any action rows; the next tick naturally reads a different `(gameId, tick)` slice
- For non-winning ticks:
  - preserve current next-tick scheduling/state update behavior
- Keep the implementation dependency-injected and `Result`-based, with no new module-scope state.

### Frontend

- Extend the `/play/$gameId` page to fetch both:
  - current game state
  - current player action
- Add a basic action menu on the play screen, colocated with current tick/resources, with:
  - a button or simple selectable card for `Make More Money`
  - a button or simple selectable card for `Win The Game`
  - disabled state and inline reason when the current money is below the action cost
  - visible indication of the currently selected action
- Mutating the selection should refresh the current action query so a page refresh shows the persisted choice.
- After a tick processes and actions are reset, the page should show no selected action on the next successful refetch.
- After a tick processes, the page should show no selected action for the new current tick unless the player chooses another one.
- If winner persistence is surfaced in existing game summary/status views, show ended state consistently; winner display on the frontend can be limited to the play page or deferred unless already needed by the changed screens.

## Detailed Steps

### Step 1: Schema and types

- Add `winnerPlayerId` to `gamesTable` with a nullable FK to `playersTable`.
- Add `gamePlayerActionsTable` with `gameId`, `playerId`, `tick`, `actionType`, `createdAt`, and `updatedAt`.
- Use FK constraints back to the game/player membership shape so action rows stay tied to valid game participants.
- Update generated migration artifacts and any inferred repository row types.

### Step 2: Action domain model

- Add a backend module for player action constants using the repo’s `as const` pattern.
- Define the supported action ids and their cost/effect metadata in one place.
- Add a Zod schema and exported type for `GamePlayerAction`.

### Step 3: Repository layer

- Create a `GamePlayerActionsRepository`.
- Implement upsert-by-primary-key for `(gameId, playerId, tick)`.
- Implement `getByGameIdPlayerIdAndTick`.
- Implement `getByGameIdAndTick`.
- Keep all DB access isolated in this repository.

### Step 4: Controller layer

- Create a `GamePlayerActionsController`.
- On `setCurrent`, fetch the player’s current game state to obtain the active tick and current money.
- Reject writes when the game state does not exist, the player is not in the game, the game has ended, or the action is unaffordable.
- Return the persisted action row mapped to the API schema.
- On `getCurrent`, read the current tick first and then fetch the action for that tick only.

### Step 5: Router integration

- Add `gamePlayerActions.router.ts`.
- Add private procedures for `getCurrent` and `setCurrent`.
- Keep the same DI and return-type pattern as the existing routers.
- Register the new router namespace in `createApi.ts`.
- Export any frontend-consumed output types if needed.

### Step 6: Tick-processing integration

- Inject `GamePlayerActionsRepository` into the tick-processing entrypoint and `processTick`.
- For each game tick being processed, fetch actions by `(gameId, gameState.tick)` once before looping players.
- Match actions to players during resolution.
- Preserve the current money increment behavior.
- Apply action effects after the passive income.
- On `WIN_THE_GAME`, persist `endedAt` and `winnerPlayerId`, skip next-tick creation, and finish the current tick cleanly.
- Do not delete or mutate historical action rows once the tick is processed.

### Step 7: Frontend integration

- Add frontend usage of the new router methods in `play.$gameId.tsx`.
- Query the current action alongside the existing game-state query.
- Render a minimal action menu with clear selected/unselected states.
- Use a mutation to change the current action and refetch the current-action query on success.
- Keep the UI resilient when no action exists for the current tick.

### Step 8: Verification pass

- Validate append-only DB behavior for multiple ticks.
- Validate that changing the action before processing overwrites only the current tick row.
- Validate that advancing the tick results in no selected action for the new tick.
- Validate that winning ends the game and persists the winner.

## Public Interfaces / Types

- New backend action type enum-like constant and Zod schema for `GamePlayerAction`.
- New tRPC router namespace: `gamePlayerActions`.
- New API payload shape:
  - `GamePlayerAction = { gameId: number; playerId: number; tick: number; actionType: "MAKE_MORE_MONEY" | "WIN_THE_GAME"; updatedAt: Date }`
- Extend game types as needed to include `winnerPlayerId: number | null` where ended-game winner display is required.

## Test Plan

- DB/repository checks:
  - can upsert an action for a player in a game and tick
  - updating the action replaces the previous selection for the same `(gameId, playerId, tick)` instead of creating duplicates
  - actions for prior ticks remain stored after processing
  - fetching actions by `(gameId, tick)` returns only that tick’s rows
- Controller/router checks:
  - rejects action submission for non-members
  - rejects action submission for not-started or ended games
  - rejects `MAKE_MORE_MONEY` below `2 money`
  - rejects `WIN_THE_GAME` below `10 money`
  - returns persisted current action after refresh/read
- Tick-processing scenarios:
  - no selected action: player still gets `+1 money`
  - `MAKE_MORE_MONEY`: player with `2` money ends tick at `6` (`2 + 1 - 2 + 5`)
  - `WIN_THE_GAME`: player with `10` money ends the game, winner is stored, no next tick is scheduled
  - after a tick advances, the next tick has no current selection until a new row is submitted for that new tick
- Manual verification:
  - select action on `/play/$gameId`, refresh, selection remains
  - change selection before tick, latest choice is the one persisted
  - once the tick passes and data refetches, selection is empty for the new current tick while the old row remains in the database
  - winning action transitions the game to ended state and prevents further play actions

## Assumptions

- Action visibility is private: only the current player can read their own selected action.
- “Hard error on affordability” means affordability is checked at submission time, not deferred to tick resolution.
- `game_player_actions` is the action-history system for v1, but reads and writes only target the current tick unless tick processing is fetching rows to resolve.
- Tick processing remains sequential per game as it is now; this plan does not add broader locking or transactional refactors beyond what is needed for action resolution and reset.
