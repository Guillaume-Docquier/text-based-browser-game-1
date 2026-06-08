# Coordinate System and Movement

This document describes how the Star System will be built based on a 3-tier coordinate system and graph structure to allow movements in the game.

## Description

### The Star System

The map consists of a single Star System. At the center of the Star System will be a star, with concentric Orbits around it. Each Orbit will be divided into Sectors and each Sector will contain Bodies.

The Star System will feature an `Orbit:Sector:Body` coordinate system. The coordinate system will be read from left to right, and any coordinate will contain one to all the tiers.

For example, these are all valid coordinates:

- `02` (orbit 2)
- `02:11` (orbit 2, sector 11)
- `02:11:05` (orbit 2, sector 11, body 5)

While all the above coordinates will be valid, not all of them will be valid for movement. Players will be able to view any of those coordinates. A link to `02` would bring the view of the player to orbit 2. However, units will only be able to move to Sectors or Bodies.

For example, these are the coordinate capabilities:

- `02` (view)
- `02:11` (view and movement)
- `02:11:05` (view and movement)

The star is artificial and only for display purposes. It is not a Body.

The game creation menu will allow customizing the following settings:

- Planet density of the Star System (range)
- Number of Planets (range)
- Number of Moons per Planet (range)
- Number of Asteroid belts (range)
- Number of Asteroids per Sector (range)
- Star System generation seed (number, optional)

Here's a representation of a System with 3 orbits and 14 sectors
![star system](../../.github/images/star-system.png)

The central dot is the star, each circle is an Orbit, and each dot on an Orbit is a Sector.

In this image, the Sector count per Orbit starts at 2 and doubles for each additional Orbit.

Asteroids will be featured through Asteroid belts. An Asteroid belt is an Orbit where each sector contains Asteroids only. There can be one or more Asteroid per Sector. Any Orbit can be an Asteroid belt, this will be chosen at random.

Moons will be attached to planets. Visually, a Moon will orbit around a Planet. However, this will have no incidence on movement.

The Star System is completely public. Every player in the game can see everything.

### Movement

We can only move to Sectors and Bodies:

- Each Body is connected to all Bodies in the same Sector.
- Each Body in a Sector is connected to that Sector.
- Each Sector is connected to all adjacent Sectors.

Here's an example:
![movement](../../.github/images/movement-sector-based.png)

In the example above every Sector has 3 to 5 adjacent Sectors

This can be represented as a graph, where each edge (arrow) has a weight of 1.

## Architecture

The Star System and its contents will be stored in a relational database with the following tables:

- StarSystemGenerationSettings: saved generation settings, by id. They are not owned by games so they can support presets later.
- StarSystems: all generated Star Systems, by game id, and the settings id used to generate them.
- Orbits
- Sectors
- Bodies

This data will only be used to express static data about the entities, not mutable game state.

The movement graph will be stored in a relational database with the following tables:

- MovementNodes: nodes that can be moved to (currently Sectors and Bodies)
- MovementEdges: the connections between nodes and their weight (distance)

The movement graph data will only be used to validate movements. Units and buildings will always refer to Sectors or Bodies, never to MovementNodes.

Although some Orbits will be Asteroid belts, it is not relevant to tag Orbits as Asteroid belts. The only effect of being an Asteroid belt is that the Sectors will all contain Asteroids instead of Planets and Moons. This will be decided during the Star System generation. After that, it will not be important to know about Asteroid belts.

### Star System generation

A Star System will be generated deterministically from the user's chosen settings and a seed. Users can provide a seed. If no seed is provided, a random one will be used.

The Star System generation algorithm will try to satisfy the user's settings with as few orbits as possible. To do so, it will:

1. Initialize the pseudo random number generator with the seed
2. Roll the density, number of planets and number of Asteroid belts ranges to get fixed values
3. Create the next orbit and roll for Asteroid belt
4. If not Asteroid belt, count the sectors, multiply by the desired density
5. If Asteroid belt, fill each Sector in the belt with X Asteroids, where X is rolled from the range of Asteroids per Sector
6. If there aren't enough sectors to satisfy the planet count, repeat from #3
7. Select all empty Sectors, shuffle them, and put a Planet in the first Y, where Y is the desired number of planets
8. For each Planet, add Z Moons in that Sector, where Z is rolled from the range of Moons per Planet

Each orbit has double the Sectors than the previous one.

The movement graph is then computed, and all the generated Star System data is saved to the DB.

The Star System will not change after being generated.

### games table Star System setting reference

The `games` table stores the selected generation settings for the game.

| Column                               | Type   | Constraints                                                | Notes                            |
| ------------------------------------ | ------ | ---------------------------------------------------------- | -------------------------------- |
| `star_system_generation_settings_id` | `uuid` | not null, references `star_system_generation_settings(id)` | Settings selected for this game. |

### star_system_generation_settings table

Generation settings are stored in a standalone table so they can be created before a Star System exists and can later support presets. A game references the settings selected for that game. A generated Star System also references the settings row that was used to generate it.

| Column                                   | Type               | Constraints           | Notes                                            |
| ---------------------------------------- | ------------------ | --------------------- | ------------------------------------------------ |
| `id`                                     | `uuid`             | primary key           | Stable settings id generated by the application. |
| `planet_density_numeric_type`            | `varchar(16)`      | not null              | Stored `Range.numericType`.                      |
| `planet_density_max_bound_type`          | `varchar(16)`      | not null              | Stored `Range.maxBoundType`.                     |
| `planet_density_min`                     | `double precision` | not null              | Stored `Range.min`.                              |
| `planet_density_max`                     | `double precision` | not null              | Stored `Range.max`.                              |
| `nb_planets_numeric_type`                | `varchar(16)`      | not null              | Stored `Range.numericType`.                      |
| `nb_planets_max_bound_type`              | `varchar(16)`      | not null              | Stored `Range.maxBoundType`.                     |
| `nb_planets_min`                         | `double precision` | not null              | Stored `Range.min`.                              |
| `nb_planets_max`                         | `double precision` | not null              | Stored `Range.max`.                              |
| `nb_moons_per_planet_numeric_type`       | `varchar(16)`      | not null              | Stored `Range.numericType`.                      |
| `nb_moons_per_planet_max_bound_type`     | `varchar(16)`      | not null              | Stored `Range.maxBoundType`.                     |
| `nb_moons_per_planet_min`                | `double precision` | not null              | Stored `Range.min`.                              |
| `nb_moons_per_planet_max`                | `double precision` | not null              | Stored `Range.max`.                              |
| `nb_asteroid_belts_numeric_type`         | `varchar(16)`      | not null              | Stored `Range.numericType`.                      |
| `nb_asteroid_belts_max_bound_type`       | `varchar(16)`      | not null              | Stored `Range.maxBoundType`.                     |
| `nb_asteroid_belts_min`                  | `double precision` | not null              | Stored `Range.min`.                              |
| `nb_asteroid_belts_max`                  | `double precision` | not null              | Stored `Range.max`.                              |
| `nb_asteroids_per_sector_numeric_type`   | `varchar(16)`      | not null              | Stored `Range.numericType`.                      |
| `nb_asteroids_per_sector_max_bound_type` | `varchar(16)`      | not null              | Stored `Range.maxBoundType`.                     |
| `nb_asteroids_per_sector_min`            | `double precision` | not null              | Stored `Range.min`.                              |
| `nb_asteroids_per_sector_max`            | `double precision` | not null              | Stored `Range.max`.                              |
| `seed`                                   | `integer`          | not null              | Seed used for deterministic generation.          |
| `created_at`                             | `timestamp`        | not null, default now | Creation timestamp.                              |

Indexes and constraints:

- Check each `*_numeric_type in ('float', 'integer')`.
- Check each `*_max_bound_type in ('inclusive', 'exclusive')`.
- Check each inclusive range with `min <= max` and each exclusive range with `min < max`.

The generation settings read model has the following shape:

```ts
import type { Range } from "@guillaume-docquier/tools-ts"

type StarSystemGenerationSettings = {
  planetDensity: Range
  nbPlanets: Range
  nbMoonsPerPlanet: Range
  nbAsteroidBelts: Range
  nbAsteroidsPerSector: Range
  seed: number
}
```

### star_systems table

| Column                   | Type        | Constraints                                                | Notes                                               |
| ------------------------ | ----------- | ---------------------------------------------------------- | --------------------------------------------------- |
| `game_id`                | `integer`   | primary key, references `games(id)` on delete cascade      | The Star System belongs to one game.                |
| `generation_settings_id` | `uuid`      | not null, references `star_system_generation_settings(id)` | Star System generation settings used for this game. |
| `created_at`             | `timestamp` | not null, default now                                      | Creation timestamp.                                 |

### orbits

| Column         | Type      | Constraints                                                    | Notes                                       |
| -------------- | --------- | -------------------------------------------------------------- | ------------------------------------------- |
| `id`           | `uuid`    | primary key                                                    | Stable row id generated by the application. |
| `game_id`      | `integer` | not null, references `star_systems(game_id)` on delete cascade | Parent Star System.                         |
| `orbit_number` | `integer` | not null                                                       | Coordinate segment, starts at 1.            |

Indexes and constraints:

- Unique `(game_id, id)`, so child tables can use same-game composite foreign keys.
- Unique `(game_id, orbit_number)`.
- Index `(game_id)`.

### sectors

| Column                 | Type               | Constraints                                                    | Notes                                                   |
| ---------------------- | ------------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| `id`                   | `uuid`             | primary key                                                    | Stable row id generated by the application.             |
| `game_id`              | `integer`          | not null, references `star_systems(game_id)` on delete cascade | Parent Star System.                                     |
| `orbit_id`             | `uuid`             | not null                                                       | Parent orbit. Same-game foreign key listed below.       |
| `sector_number`        | `integer`          | not null                                                       | Coordinate segment, starts at 1.                        |
| `angle_numeric_type`   | `varchar(16)`      | not null                                                       | Stored `Range.numericType` for the sector angle.        |
| `angle_max_bound_type` | `varchar(16)`      | not null                                                       | Stored `Range.maxBoundType` for the sector angle.       |
| `start_angle_degrees`  | `double precision` | not null                                                       | Stored `Range.min`, measured clockwise from 12 o'clock. |
| `end_angle_degrees`    | `double precision` | not null                                                       | Stored `Range.max`, measured clockwise from 12 o'clock. |
| `movement_node_id`     | `uuid`             | not null                                                       | The id of the movement node for movement queries.       |

Indexes and constraints:

- Unique `(game_id, id)`, so child tables can use same-game composite foreign keys.
- Unique `(orbit_id, sector_number)`.
- Unique `(movement_node_id)`.
- Foreign key `(game_id, orbit_id)` references `orbits(game_id, id)` on delete cascade.
- Foreign key `(game_id, movement_node_id)` references `movement_nodes(game_id, id)` on delete no action.
- Check `angle_numeric_type in ('float', 'integer')`.
- Check `angle_max_bound_type in ('inclusive', 'exclusive')`.
- Check `start_angle_degrees >= 0`, `end_angle_degrees <= 360`, and `start_angle_degrees < end_angle_degrees`.
- Index `(game_id, orbit_id)`.

### bodies

| Column             | Type           | Constraints                                                    | Notes                                              |
| ------------------ | -------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| `id`               | `uuid`         | primary key                                                    | Stable row id generated by the application.        |
| `game_id`          | `integer`      | not null, references `star_systems(game_id)` on delete cascade | Parent Star System.                                |
| `sector_id`        | `uuid`         | not null                                                       | Parent Sector. Same-game foreign key listed below. |
| `body_number`      | `integer`      | not null                                                       | Coordinate segment, starts at 1.                   |
| `body_type`        | `enum`         | not null                                                       | `PLANET`, `MOON` or `ASTEROID`.                    |
| `name`             | `varchar(255)` | not null                                                       | Body display name.                                 |
| `movement_node_id` | `uuid`         | not null                                                       | The id of the movement node for movement queries.  |

Indexes and constraints:

- Unique `(game_id, id)`, so child tables can use same-game composite foreign keys.
- Unique `(sector_id, body_number)`.
- Unique `(movement_node_id)`.
- Foreign key `(game_id, sector_id)` references `sectors(game_id, id)` on delete cascade.
- Foreign key `(game_id, movement_node_id)` references `movement_nodes(game_id, id)` on delete no action.
- Index `(game_id, sector_id)`.

### movement_nodes

| Column    | Type      | Constraints                                                    | Notes                                        |
| --------- | --------- | -------------------------------------------------------------- | -------------------------------------------- |
| `id`      | `uuid`    | primary key                                                    | Stable node id generated by the application. |
| `game_id` | `integer` | not null, references `star_systems(game_id)` on delete cascade | Parent Star System.                          |

Indexes and constraints:

- Unique `(game_id, id)`, so sectors, bodies, and edges can use same-game composite foreign keys.
- Index `(game_id)`.

Each movement node must belong to exactly one movement target: either one Sector or one Body. The DB uniqueness constraints prevent duplicate `movement_node_id` values inside each concrete target table; `StarSystemsRepository.create` must create nodes and targets in one transaction and must not create orphan nodes or reuse one node across target types.

### movement_edges

| Column         | Type      | Constraints                                                    | Notes                                                 |
| -------------- | --------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `game_id`      | `integer` | not null, references `star_systems(game_id)` on delete cascade | Parent Star System.                                   |
| `from_node_id` | `uuid`    | not null                                                       | Origin node. Same-game foreign key listed below.      |
| `to_node_id`   | `uuid`    | not null                                                       | Destination node. Same-game foreign key listed below. |
| `weight`       | `integer` | not null                                                       | Movement cost. Always `1` for now.                    |

Indexes and constraints:

- Primary key `(game_id, from_node_id, to_node_id)`.
- Foreign key `(game_id, from_node_id)` references `movement_nodes(game_id, id)` on delete cascade.
- Foreign key `(game_id, to_node_id)` references `movement_nodes(game_id, id)` on delete cascade.
- Index `(game_id, from_node_id)`.

Movement edges are stored as directed rows. For undirected movement, the repository inserts both `A -> B` and `B -> A` in the same transaction.

### Repositories

We will need 1 new repository, the `StarSystemsRepository`. This repository will expose the persisted Star System:

- `create`: Creates a Star System (orbits, sectors, bodies, movement graph, etc)
- `getByGameId`: Gets a Star System (orbits, sectors, bodies, movement graph, etc)

`getByGameId` should return something along the lines of:

```ts
type System = {
  gameId: GameId
  orbits: Orbit[]
  movementGraph: MovementGraph
}

type Orbit = {
  id: string
  number: number
  coordinates: string
  sectors: Sector[]
}

type Sector = {
  id: string
  number: number
  coordinates: string
  bodies: Body[]
  movementNodeId: MovementNodeId
}

type Body = {
  id: string
  number: number
  coordinates: string
  name: string
  type: "PLANET" | "MOON" | "ASTEROID"
  movementNodeId: MovementNodeId
}

type MovementGraph = {
  /**
   * The key is the from, as an index for bodies/sectors to query the connections from their node
   */
  edges: Record<MovementNodeId, MovementEdge[]>
}

type MovementNodeId = string

type MovementEdge = {
  fromNodeId: MovementNodeId
  toNodeId: MovementNodeId
  weight: number
}
```

### Controllers

We will need 1 new controller, the `StarSystemsController`. This controller will expose queries to the Star System:

- `getByGameId`

The controller will make sure the player is allowed to see the data (must be a player in the game).

Creating a system using `StarSystemsRepository.create` will be part of the `GamesController`.

### Routers

We will need 1 new router, the `StarSystemsRouter`. This router will expose queries to the Star System:

- `getByGameId`

The router will make sure the player is authenticated and will forward the player id to the controller.

### Star System View

The Star System view will look something like this:

| inspiration 1                                                                         | inspiration 2                                                                             |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ![AI Generated Solar System UI](../../.github/images/mockup-ai-solar-system-view.png) | ![AI Generated Solar System UI 2](../../.github/images/mockup-ai-solar-system-view-3.png) |

The key points are:

- The game layout will feature a left navigation bar
- The game layout will feature a top game info bar
- The game layout will feature a central tile, islands style, for the current view

The navigation bar at this point will contain 2 pages:

1. Star System, at `/play/$gameId` and `/play/$gameId/star-system`, shows the Star System
2. Actions, at `/play/$gameId/actions`, lets the user chose actions

The map itself should:

- Show the star in the middle
- Show each Sector as a zone
- Show each Body in the center of their Sector
  - Moons should orbit around Planets
  - Asteroids float in the sector
- Have a starry background
- Allow zooming and panning
- Have a coordinate input to zoom in on or highlight an Orbit/Sector/Body
- Allow selecting Sectors and Bodies and showing their information in the bottom section (coordinates, name, type, etc)
- Show the coordinates of Sectors but not of Planets because it would clutter the UI

Sectors should be ordered by their number, but rendered from their persisted angle Range. Initial generated Sectors use equal-sized ranges with the first Sector starting at 12 o'clock (0 degrees) and proceeding clockwise. For example, with 4 sectors:

- Sector 1 should start at 0 degrees and end at 90 degrees
- Sector 2 should start at 90 degrees and end at 180 degrees
- Sector 3 should start at 180 degrees and end at 270 degrees
- Sector 4 should start at 270 degrees and end at 360 degrees

In terms of libraries/tech, we will start with SVG + d3-zoom:

- We will generate 1 asset for a Planet
- We will generate 1 asset for a Moon
- We will generate 1 asset for an Asteroid
- We will generate 1 asset for the star
- We will generate a few assets for the starry background
- We will use annular sector paths for Sectors

### Game Creation View

The game creation view will have an extra section for the 6 Star System generation settings.

## Implementation Phases

The implementation should be split into four PRs. This document is the source of truth for Star System and movement behavior. Do not use older map descriptions in `docs/MVP.md` or `docs/GAME-DESIGN.md` to override this plan.

The four phases will be:

1. [Star System Persistence And Read API](#Phase-1-Star-System-Persistence-And-Read-API)
2. [Game Layout And Actions View](#Phase-2-Game-Layout-And-Actions-View)
3. [Game Creation Settings And Deterministic Star System Generation](#Phase-3-Game-Creation-Settings-And-Deterministic-Star-System-Generation)
4. [Map View](#Phase-4-Map-View)

Shared constraints for every phase:

- Preserve the backend layering: routers know tRPC, controllers enforce business rules, repositories own Drizzle/Postgres.
- Keep tRPC router creation side-effect free and wired through `backend/src/api/createApi.ts`.
- Do not use TypeScript `enum` in backend code. Use `as const` objects plus derived union types; a Postgres enum may be used for `body_type` if implemented through Drizzle schema definitions.
- Add backend router tests for backend behavior introduced in the phase.
- Add no frontend tests for now.
- Run the phase-specific verification command before opening the PR.
- UI work must keep the current Shadcn preset and may use the images in this document only as visual inspiration.

Dependencies:

- Phase 1 and Phase 2 are independent.
- Phase 3 depends on Phase 1.
- Phase 4 depends on Phases 1, 2, and 3.

### Phase 1: Star System Persistence And Read API

Goal: add the static Star System schema, movement graph persistence, repository reads, player-authorized controller queries, and a tRPC router. This phase does not generate the Star System during game creation; it makes the storage and read boundary available.

Files to create or update:

- `backend/src/lib/db/schema.ts`
- `backend/drizzle/*`
- `backend/src/lib/db/games/games.repository.ts`
- `backend/src/lib/db/star-systems/starSystems.repository.ts`
- `backend/src/api/star-systems/starSystems.controller.ts`
- `backend/src/api/star-systems/starSystems.router.ts`
- `backend/src/api/star-systems/starSystems.router.test.ts`
- `backend/src/api/createApi.ts`
- `backend/src/api/createApi.stub.ts`
- `backend/src/api/entry.api.ts`
- `backend/src/api/types.ts`

Implementation steps:

1. Add the Star System tables to `backend/src/lib/db/schema.ts`: `star_system_generation_settings`, `star_systems`, `movement_nodes`, `orbits`, `sectors`, `bodies` and `movement_edges`.
2. Match the constraints from the Architecture section exactly: cascade from `games` to `star_systems`, composite same-game foreign keys for child rows, directed movement edges with primary key `(game_id, from_node_id, to_node_id)`, unique movement node references from concrete targets, and indexes on game/parent lookup columns.
3. Use explicit SQL column names from this document while keeping TypeScript properties camelCase, for example `gameId: integer("game_id")`.
4. Store Star System generation settings as columns in `star_system_generation_settings`. The range fields use the same column pattern as Sector angle ranges: `numeric_type`, `max_bound_type`, `min`, and `max`.
5. Represent Body types as `PLANET`, `MOON` and `ASTEROID`. Use a backend `BodyType` const object and derived union type. If the schema uses a Postgres enum, keep it as a Drizzle runtime schema construct, not a TypeScript enum.
6. Follow the table definition for `movement_edges`: do not add an undocumented edge id just because the illustrative `MovementEdge` type above contains one. Return `{ fromNodeId, toNodeId, weight }` from API DTOs.
7. Generate the migration with `pnpm --filter backend db:generate --name star-systems`.
8. Implement `StarSystemsRepository` with public methods `create` and `getByGameId`.
9. Make repository methods return `Result`, wrap Drizzle calls in `Result.tryCatch`, log only where a new `Failure` is created, and accept an optional trailing `db = this.db` parameter for transaction reuse.
10. Make `create` accept an already-generated Star System payload and insert the Star System, movement nodes, Orbits, Sectors, Bodies, and directed edges in one transaction. It must never leave orphan MovementNodes or partially inserted targets. Business logic not validated by the database through the specified constraints should be enforced by the controller, not the repository. The repository is only handling access patterns.
11. Make `getByGameId` return Orbits ordered by `orbit_number`, Sectors by `sector_number`, Bodies by `body_number`, generated coordinates like `02:11:05`, and a MovementGraph keyed by `MovementNodeId`. Account for the fact that numeric object keys serialize as strings over JSON/tRPC.
12. Implement `StarSystemsController` with `getByGameId`. The method must first verify that the requesting player is in the game through `GamesRepository.hasPlayerJoinedGame(gameId, playerId)`.
13. Return `Result` values for expected failures: missing game, player not in game, and missing Star System.
14. Implement `createStarSystemsRouter` with a private procedure for `getByGameId`. Use Zod input parsing for `gameId`; map Star System controller failures to `TRPCError` with `BAD_REQUEST` or `NOT_FOUND` as appropriate.
15. Wire `StarSystemsRepository`, `StarSystemsController` and `createStarSystemsRouter` through `createApi.ts`, `createApi.stub.ts` and `entry.api.ts`, preserving the local factory pattern and `TrpcRouter` inference.
16. Export frontend-consumable Star System output types from `backend/src/api/types.ts`.

Backend tests:

- `starSystems.getByGameId` returns the full stored System for an authenticated player in the game.
- `starSystems.getByGameId` rejects anonymous reads with `UNAUTHORIZED`.
- `starSystems.getByGameId` rejects a player who is authenticated but not in the game.
- Existing game with no Star System returns `NOT_FOUND`.

Definition of done:

- A hand-built System fixture can be persisted and read back through tRPC.
- Sectors and Bodies are the only movement targets.
- Units and buildings have not been introduced, and no mutable game state is stored on the Star System tables.
- `pnpm --filter backend checks` passes.

### Phase 2: Game Layout And Actions View

Goal: reshape the play surface into a game layout with a left navigation bar, top game info bar, Star System route, and Actions route. This phase keeps the current action behavior but moves it into the Actions page.

Files to create or update:

- `frontend/src/routes/_game.games.$gameId.play.tsx`
- `frontend/src/routes/_game.games.$gameId.play.index.tsx`
- `frontend/src/routes/_game.games.$gameId.play.star-system.tsx`
- `frontend/src/routes/_game.games.$gameId.play.actions.tsx`
- `frontend/src/features/play/PlayGameLayout.tsx`
- `frontend/src/features/play/StarSystemPage.tsx`
- `frontend/src/features/play/PlayerActionsPage.tsx`
- `frontend/src/features/play/PlayContext.tsx`
- `frontend/src/features/play/components/GameLayout.tsx`
- `frontend/src/features/play/components/GameTopBar.tsx`
- `frontend/src/features/play/components/GameSideNav.tsx`
- `frontend/src/features/play/components/GameActionSelector.tsx`
- `frontend/src/routeTree.gen.ts`

Implementation steps:

1. Convert `frontend/src/routes/_game.games.$gameId.play.tsx` from the current single-page implementation into the authenticated layout route for `/games/$gameId/play`.
2. Keep the existing route param parsing and private-route protection on the layout route.
3. Fetch `games.getSummaryById` and `gameStates.getById` in the layout route so the top bar has the game name, status, winner state, current Tick, and next Tick time.
4. Add `PlayGameLayout` as the feature-level layout component that fetches play-shell data and provides shared play context.
5. Add `GameLayout` with a left navigation bar, top game info bar, and central content region. Use full-width layout bands and avoid nested cards.
6. Add `GameSideNav` with two links: Star System at `/games/$gameId/play/star-system` and Actions at `/games/$gameId/play/actions`.
7. Add `GameTopBar` with compact game identity, status, Tick, countdown, and winner display. Reuse `GameStatusBadge` and existing Shadcn UI components.
8. Add `_game.games.$gameId.play.index.tsx` so `/games/$gameId/play` lands on the Star System experience. During Phase 2 it may redirect to or render the same temporary map placeholder as `/games/$gameId/play/star-system`; Phase 4 replaces that placeholder with the real map.
9. Add `_game.games.$gameId.play.star-system.tsx` as a thin route file that renders `StarSystemPage`, which fits the new layout and states that the map view area exists without implementing SVG map rendering yet.
10. Move the current action selection logic from the play route into `PlayerActionsPage`, rendered by `_game.games.$gameId.play.actions.tsx`.
11. Extract the action cards, affordability messaging, deselection behavior, and mutation handling into `GameActionSelector`.
12. Guard disabled or unaffordable actions before mutation so disabled-looking cards cannot still submit on click.
13. Keep all current data calls and mutation behavior for actions: `gamePlayerActions.getCurrentAction`, `gamePlayerActions.setCurrentAction`, resource display and full-query invalidation through `BackendApiClient`.
14. Make loading and error states feature-local: layout loading handles game/game-state data, Actions loading handles current action data.
15. Regenerate TanStack Router output by running the frontend build or the route generator through the existing Vite workflow. Do not hand-edit `frontend/src/routeTree.gen.ts`.
16. Do not add `d3`, `d3-zoom` or map-rendering dependencies in this phase.

Backend tests:

- No new backend behavior is introduced in Phase 2, so no backend router tests are added in this phase.
- Existing `gamePlayerActions.router.test.ts` and `gameStates.router.test.ts` remain the coverage for the moved Actions UI data paths.

Manual verification:

- `/games/$gameId/play` opens the Star System page inside the new game layout.
- `/games/$gameId/play/star-system` opens the same Star System area.
- `/games/$gameId/play/actions` shows the current action selector and preserves click-again-to-clear behavior.
- The side navigation highlights the active route.
- Winner, Tick and countdown information remain visible outside the Actions page.
- Mobile width keeps navigation and top bar readable without overlapping content.

Definition of done:

- Phase 2 can ship before Phase 1 because it does not call `starSystems`.
- The current action flow behaves the same as before from the player's perspective.
- `pnpm --filter frontend checks` passes.

### Phase 3: Game Creation Settings And Deterministic Star System Generation

Goal: collect Star System generation settings during game creation, persist the selected settings on the game, and later deterministically generate the Star System and movement graph from those exact settings when the game starts.

Files to create or update:

- `backend/src/lib/mulberry32prng.ts`
- `backend/src/lib/star-systems/generateStarSystem.ts`
- `backend/src/lib/star-systems/generateStarSystem.test.ts`
- `backend/src/lib/star-systems/Coordinates.ts`
- `backend/src/lib/db/games/games.repository.ts`
- `backend/src/lib/db/star-systems/starSystems.repository.ts`
- `backend/src/lib/db/star-systems/starSystemGenerationSettings.repository.ts`
- `backend/src/lib/db/star-systems/StarSystemGenerationSettings.stub.ts`
- `backend/src/api/games/games.controller.ts`
- `backend/src/api/games/games.router.ts`
- `backend/src/api/games/games.router.test.ts`
- `backend/src/api/createApi.ts`
- `backend/src/api/createApi.stub.ts`
- `backend/src/api/entry.api.ts`
- `frontend/src/routes/_site.games.create.tsx`
- `frontend/src/features/games/CreateGamePage.tsx`

Implementation steps:

1. Reuse `Range` from `@guillaume-docquier/tools-ts`.
2. Keep `StarSystemGenerationSettings` in `backend/src/lib/db/star-systems/starSystemGenerationSettings.repository.ts`, matching the shape in this document exactly.
3. Create a `CreateGameDto` in `backend/src/api/games/games.controller.ts`, then expand it to include the star system generation settings.
4. Update the `games.create` router input to require `StarSystemGenerationSettings` alongside `name`, `nbSeats` and `tickIntervalSeconds`.
5. Normalize a missing seed in `GamesController.create` to a random unsigned 32-bit integer before settings persistence. The value persisted in `star_system_generation_settings.seed` must always be numeric.
6. Inject `StarSystemGenerationSettingsRepository` and `createTransaction` into `GamesController`.
7. Implement `generateStarSystem` as a pure function that accepts normalized `StarSystemGenerationSettings` and returns the full payload expected by `StarSystemsRepository.create`.
8. Implement a deterministic local PRNG using the Mulberry32 algorithm in `backend/src/lib/mulberry32prng.ts`
9. Add explicit generation limits, including a `MAX_ORBITS` guard of 6, so invalid or extreme settings cannot create infinite loops or huge accidental inserts.
10. Roll the fixed generation values from the configured ranges: planet density, number of Planets, number of Asteroid belts. Moons per Planet and Asteroids per Sector will be rolled per Planet/Sector to allow variance, not once per Star System generation.
11. Generate Orbits until the non-belt Sector capacity can satisfy the rolled Planet count with as few Orbits as possible.
12. Give each Orbit double the Sector count of the previous Orbit.
13. Randomly choose Asteroid belt Orbits during generation. Do not persist an Asteroid-belt flag because the generated Bodies are the durable result.
14. Fill Asteroid belt Sectors with Asteroids by rolling a value within the configured Asteroids-per-Sector range for each Sector.
15. Select empty non-belt Sectors for Planets by shuffling deterministically and placing Planets in the first `nbPlanets` selected Sectors.
16. Add Moons to Planet Sectors by rolling a value within the configured Moons-per-Planet range for each Planet. Moons affect rendering only and do not create special movement rules.
17. Build MovementNodes for every Sector and Body.
18. Build directed MovementEdges for every undirected relation: Body-to-Body inside the same Sector, Body-to-Sector inside the same Sector, same-Orbit neighboring Sectors, and radial Sector adjacency between doubled Orbits.
19. Compute Sector adjacency from the generated Orbits and Sector numbering rules. Lock the exact adjacency rule in tests because the document specifies the desired graph behavior but not every arithmetic detail.
20. Reuse the existing coordinate formatting helpers in `Coordinates.ts` for `02`, `02:11` and `02:11:05`; update them only if repository DTOs or tests need additional coverage.
21. Save game creation and settings creation atomically from `GamesController.create`. Use the injected `createTransaction` to open one transaction, then call `StarSystemGenerationSettingsRepository.create(..., tx)` and `GamesRepository.create(..., tx)` before the transaction commits.
22. Keep `GamesController.create` as the orchestrator that validates input, normalizes seed/settings, and persists the selected settings. Star System generation happens later from those stored settings.
23. Update `games.router.test.ts` fixtures so every game creation passes deterministic Star System generation settings.
24. Add a router test proving `games.create` persists Star System generation settings and stores their id on the created game.
25. Add a router test proving invalid generation ranges fail with `BAD_REQUEST`.
26. Add a router test proving the omitted seed is persisted as a generated unsigned 32-bit numeric seed.
27. Add unit tests for the generator: same settings plus the same seed returns identical output, different seeds return different Body placement, exact counts with min=max ranges, minimal Orbit count, Asteroid belts contain only Asteroids, MovementEdges are reciprocal, and MovementNodes target only Sectors or Bodies.

Frontend steps:

1. Add a "Star System generation" section to `frontend/src/features/games/CreateGamePage.tsx`.
2. Add inputs for the six settings: Planet density of the System, Number of Planets, Number of Moons per Planet, Number of Asteroid belts, Number of Asteroids per Sector, and Seed.
3. Use paired numeric inputs for ranges and one numeric input for Seed.
4. Keep Seed optional in the UI. If the player leaves it blank, send no seed and let the backend normalize the setting.
5. Use these default UI values: `planetDensity` `0.4` to `0.6`, `nbPlanets` `9` to `11`, `nbMoonsPerPlanet` `1` to `3`, `nbAsteroidBelts` `1` to `1`, `nbAsteroidsPerSector` `1` to `3`, and an empty Seed input.
6. Keep local validation simple and visible: disable Create when any range is invalid, density is outside 0 to 1, integer settings are below 0, or `min > max`.
7. Submit `StarSystemGenerationSettings` through the existing `games.create` mutation.
8. Keep the successful navigation to `/games/$gameId`.

Definition of done:

- Creating a game stores its selected Star System generation settings.
- Starting a game generates and stores its deterministic Star System in the Phase 1 tables using the settings referenced by the game.
- The generation seed is persisted in `star_system_generation_settings.seed`.
- `pnpm checks` pass.

### Phase 4: Map View

Goal: replace the Phase 2 Map placeholder with the actual SVG + `d3-zoom` map view using persisted System data from the Phase 1 API and generated data from Phase 3.

Files to create or update:

- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/src/routes/_game.games.$gameId.play.index.tsx`
- `frontend/src/routes/_game.games.$gameId.play.star-system.tsx`
- `frontend/src/features/play/StarSystemPage.tsx`
- `frontend/src/features/play/components/StarSystemView.tsx`
- `frontend/src/features/play/components/StarSystemSvg.tsx`
- `frontend/src/features/play/components/StarSystemControls.tsx`
- `frontend/src/features/play/components/StarSystemSelectionPanel.tsx`
- `frontend/src/features/play/components/StarSystemCoordinateInput.tsx`
- `frontend/src/features/play/starSystemGeometry.ts`
- `frontend/src/features/play/starSystemCoordinates.ts`
- `frontend/src/features/play/useStarSystemZoom.ts`
- `frontend/src/assets/star-system/*`

Implementation steps:

1. Add the frontend dependencies required by this document: `d3-zoom` and `d3-selection`. Add TypeScript types if the packages do not ship the needed declarations.
2. Query `backendApiClient.starSystems.getByGameId` from `StarSystemPage`, rendered by `_game.games.$gameId.play.star-system.tsx`.
3. Make `_game.games.$gameId.play.index.tsx` redirect to or render the same Map view as `/games/$gameId/play/star-system` so both documented routes show the map experience.
4. Add runtime visual assets for one Planet, one Moon, one Asteroid, one star, and a few starry background variants under `frontend/src/assets/star-system/`. Do not load files from `.github/images` at runtime.
5. Implement `StarSystemView` as the page-level composition: loading state, error state, coordinate controls, central map, and selection panel.
6. Implement `StarSystemSvg` as the main SVG renderer. Render the star at the center, Orbits as concentric bands and Sectors as annular sector paths.
7. Implement geometry in `starSystemGeometry.ts`: render each Sector from its persisted `angleRange.min`, `angleRange.max`, and `angleRange.maxBoundType`. Do not derive Sector angles from `sector_number` and sibling count in the frontend.
8. Render Bodies inside their Sector. Planets sit near the center of the Sector band, Moons orbit visually around their Planet, and Asteroids float inside their Sector.
9. Show Sector coordinates on the map. Do not show Body coordinates directly on the map because that would clutter the UI.
10. Use `d3-zoom` for pan and zoom on one inner SVG content group. Let d3 mutate only the transform on that group; React continues to own the rendered Sectors and Bodies.
11. Implement `StarSystemCoordinateInput` accepting `Orbit`, `Orbit:Sector` and `Orbit:Sector:Body` formats. Submitting an Orbit zooms to the Orbit, submitting a Sector zooms to the Sector, and submitting a Body zooms to the Body.
12. Implement coordinate parsing in `frontend/src/features/play/starSystemCoordinates.ts`; keep it frontend-specific and aligned with backend output formatting.
13. Allow selecting Sectors and Bodies. Selection updates `StarSystemSelectionPanel` with coordinates, name, type, and movement-neighbor summary.
14. Use the MovementGraph from `getByGameId` to highlight immediate movement neighbors for the selected Sector or Body.
15. Add empty states for games with no Star System and error states for failed Star System queries.
16. Keep the map inside the Phase 2 game layout with the left nav and top info bar visible.
17. Keep the UI responsive: on narrow screens, controls and selection panel stack below the SVG; on desktop, the SVG remains the central focus.
18. Confirm that pan/zoom state changes do not repeatedly refetch `starSystems.getByGameId`.

Backend tests:

- Add a `starSystems.getByGameId` router test for a generated Star System created from the settings referenced by the game; assert the output contains Orbits, Sectors, Bodies, and MovementGraph data suitable for the Star System.
- Add coverage for selection behavior using the data returned by `starSystems.getByGameId`; do not add narrow detail queries unless the Star System API is intentionally expanded in a future phase.

Manual verification:

- `/games/$gameId/play` and `/games/$gameId/play/star-system` render a non-empty Star System for a game created after Phase 3.
- Pan and zoom work with mouse, trackpad, and touch-like browser emulation.
- The coordinate input zooms to `02`, `02:11` and `02:11:05` when those coordinates exist.
- Selecting a Sector shows its coordinate and Bodies in the bottom section.
- Selecting a Body shows its coordinate, name, and type.
- Sector labels are visible and Body labels are not rendered on-map.
- Moons visually orbit around Planets and Asteroids remain inside their Sector.
- The view remains usable at mobile and desktop widths.

Definition of done:

- The Map consumes the persisted Star System model rather than hardcoded sample data.
- The visual ordering of Sectors matches the coordinate rules in this document.
- The current Shadcn preset remains unchanged.
- `pnpm --filter frontend checks` passes.
