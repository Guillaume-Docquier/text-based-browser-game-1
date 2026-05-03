# Coordinate System and Movement

This document describes how the star map will be built based on a 5-tier coordinate system and graph structure to allow movements in the game.

## Description

### The World

The world will feature a `System:Orbit:Sector:Body:Site` coordinate system. The coordinate system will be read from left to right and any coordinate will contain one to five of the five tiers.

For example, these are all valid coordinates:

- `01` (system 1)
- `01:02:11` (system 1, orbit 2, sector 11)
- `01:02:11:05:03` (system 1, orbit 2, sector 11, body 5, site 3)

While all the above coordinates will be valid, not all of them will be valid for movement. Players will be able to view any of those coordinates. A link to `01:02` would bring the view of the player to system 1, orbit 2. However, units will only be able to move to Body or Sites.

For example, these are the coordinate capabilities:

- `01` (view)
- `01:02` (view)
- `01:02:11` (view)
- `01:02:11:05` (view and movement)
- `01:02:11:05:03` (view and movement)

The game creation menu will allow customizing the following aspects:

- Number of Systems (range)
  - Planet density (range)
  - Number of Planets per System (range)
  - Number of Sites per Planet (range)
- Presence of Asteroids (yes/no)
  - Number of Asteroids per Sector (range)
  - Number of Sites per Asteroid (range)
- Presence of Moons (yes/no)
  - Number of Moons per Planet (range)
  - Number of Sites per Moon (range)

Here's a representation of a System with 3 orbits and 14 sectors
![star system](../../.github/images/star-system.png)

The central dot is the Star, each circle is an Orbit and each dot on an Orbit is a Sector.

In this image, the Sector count per Orbit starts at 2 and doubles for each additional Orbit.

Asteroids will be featured through Asteroid belts. An Asteroid belt is an orbit where each sector contains Asteroids only. There can be one or more Asteroid per Sector. Any Orbit can be an Asteroid belt, this will be chosen at random. In the core Ruleset, Asteroids will have a single Site and won't be claimable, like Planets or Moons.

Moons will be attached to planets. Visually, a Moon will orbit around a Planet. However, this will have little incidence on movement. In the core Ruleset, Moons will have fewer Sites than Planets.

### Movement

We can only move to Planets or Sites:

- Each Site is connected to the lower orbit of its Body.
- Each Body is connected to all Bodies in the same Sector.
- Each Body in a Sector is connected to all Bodies in the closest Sector clockwise on the same Orbit.
- Each Body in a Sector is connected to all Bodies in the closest Sector anti-clockwise on the same Orbit.
- Each Body in a Sector is connected to all Bodies in the closest Sector (absolute distance) of the lower Orbits.

Here's an example:
![movement](../../.github/images/movement.png)

When moving, distance does not matter for now.

This can be represented as a graph, where each edge has a weight of 1.

## Architecture

Note: AI dump to review

The generated map should be stored as normal relational data. Coordinates are derived from the hierarchy and can be cached for display, but the source of truth is the map hierarchy plus the movement graph.

Use `varchar` columns for type-like values such as `body_type`, `orbit_type`, `node_type` and `edge_type`. Backend code should expose those values through `as const` objects plus derived union types, not TypeScript enums.

### Map Tables

#### `game_maps`

One row per generated game map.

| Column              | Type           | Constraints                                           | Notes                                            |
| ------------------- | -------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `game_id`           | `integer`      | primary key, references `games(id)` on delete cascade | The map belongs to one game.                     |
| `generation_seed`   | `varchar(255)` | not null                                              | Seed used to generate the map deterministically. |
| `settings_snapshot` | `jsonb`        | not null                                              | Map generation settings used for this game.      |
| `created_at`        | `timestamp`    | not null, default now                                 | Creation timestamp.                              |

#### `game_map_systems`

Systems are the first coordinate tier.

| Column          | Type           | Constraints                                                 | Notes                             |
| --------------- | -------------- | ----------------------------------------------------------- | --------------------------------- |
| `id`            | `integer`      | primary key, generated identity                             | Stable row id.                    |
| `game_id`       | `integer`      | not null, references `game_maps(game_id)` on delete cascade | Parent map.                       |
| `system_number` | `integer`      | not null                                                    | Coordinate segment, such as `01`. |
| `name`          | `varchar(255)` | nullable                                                    | Optional display name.            |

Indexes and constraints:

- Unique `(game_id, system_number)`.

#### `game_map_orbits`

Orbits are the second coordinate tier.

| Column         | Type           | Constraints                                                   | Notes                                     |
| -------------- | -------------- | ------------------------------------------------------------- | ----------------------------------------- |
| `id`           | `integer`      | primary key, generated identity                               | Stable row id.                            |
| `game_id`      | `integer`      | not null, references `game_maps(game_id)` on delete cascade   | Parent map.                               |
| `system_id`    | `integer`      | not null, references `game_map_systems(id)` on delete cascade | Parent system.                            |
| `orbit_number` | `integer`      | not null                                                      | Coordinate segment, such as `02`.         |
| `sector_count` | `integer`      | not null                                                      | Number of sectors on this orbit.          |
| `orbit_type`   | `varchar(255)` | not null                                                      | For example, `NORMAL` or `ASTEROID_BELT`. |

Indexes and constraints:

- Unique `(system_id, orbit_number)`.
- Index `(game_id, system_id)`.

#### `game_map_sectors`

Sectors are the third coordinate tier.

| Column          | Type      | Constraints                                                  | Notes                             |
| --------------- | --------- | ------------------------------------------------------------ | --------------------------------- |
| `id`            | `integer` | primary key, generated identity                              | Stable row id.                    |
| `game_id`       | `integer` | not null, references `game_maps(game_id)` on delete cascade  | Parent map.                       |
| `orbit_id`      | `integer` | not null, references `game_map_orbits(id)` on delete cascade | Parent orbit.                     |
| `sector_number` | `integer` | not null                                                     | Coordinate segment, such as `11`. |
| `sort_order`    | `integer` | not null                                                     | Clockwise order on the orbit.     |

Indexes and constraints:

- Unique `(orbit_id, sector_number)`.
- Unique `(orbit_id, sort_order)`.
- Index `(game_id, orbit_id)`.

#### `game_map_bodies`

Bodies are the fourth coordinate tier. Planets, asteroids and moons are all bodies.

| Column           | Type           | Constraints                                                   | Notes                                        |
| ---------------- | -------------- | ------------------------------------------------------------- | -------------------------------------------- |
| `id`             | `integer`      | primary key, generated identity                               | Stable row id.                               |
| `game_id`        | `integer`      | not null, references `game_maps(game_id)` on delete cascade   | Parent map.                                  |
| `sector_id`      | `integer`      | not null, references `game_map_sectors(id)` on delete cascade | Parent sector.                               |
| `body_number`    | `integer`      | not null                                                      | Coordinate segment, such as `05`.            |
| `body_type`      | `varchar(255)` | not null                                                      | For example, `PLANET`, `ASTEROID` or `MOON`. |
| `parent_body_id` | `integer`      | nullable, references `game_map_bodies(id)` on delete cascade  | Parent planet for moons.                     |
| `claimable`      | `boolean`      | not null                                                      | Whether gameplay can claim this body.        |
| `name`           | `varchar(255)` | nullable                                                      | Optional display name.                       |

Indexes and constraints:

- Unique `(sector_id, body_number)`.
- Index `(game_id, sector_id)`.
- Index `(parent_body_id)`.

#### `game_map_sites`

Sites are the fifth coordinate tier.

| Column        | Type           | Constraints                                                  | Notes                                |
| ------------- | -------------- | ------------------------------------------------------------ | ------------------------------------ |
| `id`          | `integer`      | primary key, generated identity                              | Stable row id.                       |
| `game_id`     | `integer`      | not null, references `game_maps(game_id)` on delete cascade  | Parent map.                          |
| `body_id`     | `integer`      | not null, references `game_map_bodies(id)` on delete cascade | Parent body.                         |
| `site_number` | `integer`      | not null                                                     | Coordinate segment, such as `03`.    |
| `site_type`   | `varchar(255)` | nullable                                                     | Ruleset-defined site classification. |
| `name`        | `varchar(255)` | nullable                                                     | Optional display name.               |

Indexes and constraints:

- Unique `(body_id, site_number)`.
- Index `(game_id, body_id)`.

### Movement Graph Tables

Only bodies and sites are valid movement destinations, so the movement graph should only contain body and site nodes. The frontend can still receive the whole graph as JSON from the API; these tables are the canonical backend model used for validation and tick processing.

#### `game_map_movement_nodes`

Canonical movement nodes for body and site coordinates.

| Column       | Type           | Constraints                                                  | Notes                                        |
| ------------ | -------------- | ------------------------------------------------------------ | -------------------------------------------- |
| `id`         | `integer`      | primary key, generated identity                              | Stable node id.                              |
| `game_id`    | `integer`      | not null, references `game_maps(game_id)` on delete cascade  | Parent map.                                  |
| `node_type`  | `varchar(255)` | not null                                                     | `BODY` or `SITE`.                            |
| `body_id`    | `integer`      | nullable, references `game_map_bodies(id)` on delete cascade | Set for body nodes.                          |
| `site_id`    | `integer`      | nullable, references `game_map_sites(id)` on delete cascade  | Set for site nodes.                          |
| `coordinate` | `varchar(255)` | not null                                                     | Cached coordinate string for API and UI use. |

Indexes and constraints:

- Unique `(game_id, coordinate)`.
- Unique `(body_id)` where `body_id is not null`.
- Unique `(site_id)` where `site_id is not null`.
- Index `(game_id, node_type)`.
- Exactly one of `body_id` or `site_id` must be set.

#### `game_map_movement_edges`

Directed graph edges between movement nodes. Insert both directions when movement should be symmetric.

| Column         | Type           | Constraints                                                          | Notes                                                                                                 |
| -------------- | -------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `game_id`      | `integer`      | not null, references `game_maps(game_id)` on delete cascade          | Parent map.                                                                                           |
| `from_node_id` | `integer`      | not null, references `game_map_movement_nodes(id)` on delete cascade | Origin node.                                                                                          |
| `to_node_id`   | `integer`      | not null, references `game_map_movement_nodes(id)` on delete cascade | Destination node.                                                                                     |
| `weight`       | `integer`      | not null, default `1`                                                | Movement cost. Always `1` for now.                                                                    |
| `edge_type`    | `varchar(255)` | not null                                                             | For example, `SITE_BODY`, `SAME_SECTOR`, `CLOCKWISE_SECTOR`, `ANTICLOCKWISE_SECTOR` or `LOWER_ORBIT`. |

Indexes and constraints:

- Primary key `(game_id, from_node_id, to_node_id)`.
- Index `(game_id, to_node_id)`.

#### `game_map_graph_snapshots`

Optional cached read model for fetching the whole movement graph quickly.

| Column          | Type        | Constraints                                                    | Notes                                                     |
| --------------- | ----------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| `game_id`       | `integer`   | primary key, references `game_maps(game_id)` on delete cascade | Parent map.                                               |
| `graph_version` | `integer`   | not null                                                       | Increment when the graph snapshot is rebuilt.             |
| `graph_json`    | `jsonb`     | not null                                                       | Serialized `{ nodes, edges }` graph for frontend display. |
| `updated_at`    | `timestamp` | not null, default now                                          | Last rebuild timestamp.                                   |

The snapshot is not the source of truth. It should be rebuilt from `game_map_movement_nodes` and `game_map_movement_edges`.

## Implementation Plan
