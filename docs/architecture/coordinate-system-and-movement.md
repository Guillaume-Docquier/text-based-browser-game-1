# Coordinate System and Movement

## Overview

Each game takes place in one Star System.

The Star System contains:

- one visual star at its center;
- concentric Orbits around the star;
- Sectors dividing each Orbit;
- Bodies contained within Sectors;
- a movement graph connecting Sectors and Bodies.

The star is part of the map presentation, but it is not a Body and cannot be targeted for movement.

![Star System](../../.github/images/star-system.png)

## Coordinates

The Star System uses an `Orbit:Sector:Body` coordinate system. Each segment is displayed with two digits.

Examples:

- `02`: Orbit 2
- `02:11`: Sector 11 in Orbit 2
- `02:11:05`: Body 5 in Sector 11 of Orbit 2

Coordinates can identify different levels of the map:

- Orbits can be viewed.
- Sectors can be viewed and targeted for movement.
- Bodies can be viewed and targeted for movement.

Orbit, Sector, and Body numbers start at 1.

## Orbits and Sectors

Orbits are concentric bands centered on the star.

The first Orbit contains two Sectors. Each subsequent Orbit contains twice as many Sectors as the previous Orbit:

| Orbit | Sector count |
| ----- | ------------ |
| 1     | 2            |
| 2     | 4            |
| 3     | 8            |
| 4     | 16           |
| 5     | 32           |

Each Sector owns an angular range measured clockwise from 12 o'clock. The Sectors in an Orbit divide the complete `0°` to `360°` circle into equally wide ranges.

Sector angle ranges use floating-point values so Orbits whose Sector count does not divide 360 into whole numbers can still be divided evenly. Adjacent ranges share the same boundary, and the final Sector in every Orbit ends at exactly `360°`.

The angular ranges are durable Star System data. Rendering and movement adjacency use these stored ranges instead of deriving angles again from Sector numbers.

## Bodies

Bodies belong to Sectors. The supported Body types are:

- Planet
- Moon
- Asteroid

A normal populated Sector contains a Planet as Body 1. Any Moons in that Sector use the following Body numbers.

An asteroid-belt Sector contains one or more Asteroids. Asteroid belts are represented by their resulting Bodies; an Orbit does not need a durable asteroid-belt flag after generation.

Body names and coordinates identify Bodies independently from their visual position.

### Map presentation

The map renders the star at the center and each Orbit as an annular band divided by its Sectors' angular ranges.

Within a populated Sector:

- Body 1 is rendered at the center of the Sector.
- Additional Bodies are rendered around Body 1.
- A visual orbit line is shown around Planets with Moons.
- Asteroids are distributed around the first Asteroid without a visual orbit line.

Sectors and Bodies provide hover and keyboard-focus feedback. The map can be panned and zoomed, while its legend and summary remain fixed.

These presentation rules do not affect movement.

## Units

Units are generic player-owned entities. Every Unit has one concrete location: either a Sector or a Body. Sectors and Bodies share a common Movement Target identity. Units store that target identity, and multiple Units from any combination of players may share the same location.

Players can submit a Build Unit order for a Sector or Body in their game. Build costs one money. During tick processing, the player first receives the normal income and then pays the Build cost and receives one Unit at the selected destination.

Units are public game information. Every player receives every Unit and its owner through the player view. The map renders Units as small triangles using the owning player's color, with overlapping diagonal stacks when multiple Units share a location.

## Star System generation

The Star System is generated when the game starts. Generation is deterministic for a given set of settings and seed.

The configurable generation settings are:

- Planet density
- Number of Planets
- Number of Moons per Planet
- Number of asteroid belts
- Number of Asteroids per Sector
- Seed

Generation creates enough Orbits to contain the requested Planets at the selected density, while respecting the configured asteroid belts and the maximum supported Orbit count.

At a high level, generation:

1. Resolves the configured ranges to concrete values through a seeded pseudo-random number generator.
2. Determines the required Orbits and which of them are asteroid belts.
3. Creates equally divided Sectors and their angular ranges.
4. Populates asteroid-belt Sectors with Asteroids.
5. Selects normal Sectors for Planets.
6. Adds the generated Moons to their Planet's Sector.
7. Creates the movement edges between the generated targets.

The generated Star System is static. Orbits, Sectors, Bodies, and their movement topology do not change during the game.

## Movement

Only Sectors and Bodies are movement targets.

The movement rules are:

- Neighboring Sectors are connected.
- Every Body is connected to its Sector.
- All Bodies in the same Sector are interconnected.

![Sector-based movement](../../.github/images/movement-sector-based.png)

### Sector neighbors

Sectors are neighbors when either of these conditions is true:

- They are on the same Orbit and their angular ranges touch. This includes the wraparound boundary between `360°` and `0°`.
- They are on adjacent Orbits and their angular ranges overlap.

Sectors separated by more than one Orbit are not directly connected.

### Movement graph

Movement is represented as a graph:

- each Sector and Body is a Movement Target;
- the Movement Target identity is also the Sector or Body identity;
- the star and Orbits are not Movement Targets;
- connections are stored as directed edges between Movement Targets;
- an undirected gameplay connection is represented by reciprocal directed edges;
- movement edges currently have a weight of 1.

Units, buildings, orders, and movement edges all refer to the same Movement Target identities. The target's discriminator identifies whether its type-specific information lives in the Sectors or Bodies relation.

## High-level architecture

### Game configuration

The selected Star System generation settings belong to the game's configuration. They are persisted before the game starts and are used to generate the Star System when the game begins.

### Generation

Star System generation is deterministic. Given the same normalized settings and seed, it produces the same map structure, Body placement, and movement topology by using a seeded pseudo random number generator.

The gameplay start flow orchestrates generation and persistence as one operation so a game cannot start with a partially stored Star System.

### Persistence

The generated Star System is stored relationally as:

- one Star System owned by a game;
- Orbits owned by the Star System;
- Movement Targets owned by the Star System, providing one shared identity and discriminator for every movable location;
- Sectors owned by Orbits and using their Movement Target identity as their own identity;
- Bodies owned by Sectors and using their Movement Target identity as their own identity;
- movement edges connecting Movement Targets;
- Units owned by players and located on exactly one Movement Target.

Repositories own all database access and reconstruct the persisted rows into the Star System read model.

The database preserves stable identities, coordinate ordering, parent-child ownership, unique movement targets, and valid angular bounds.

### Player view

The gameplay player view is the public read boundary for the Star System. It exposes:

- ordered Orbits;
- ordered Sectors with coordinates and angular ranges;
- ordered Bodies with coordinates, names, and types;
- movement edges indexed by Movement Target identity;
- Units indexed by Unit identity, including their owner and Movement Target location.

The Star System and Units are public game information. Every player in the game receives the same static Star System data and current Unit state through their player view.

### Frontend

The frontend renders the persisted Star System from the player view. It does not regenerate Sector geometry or maintain a separate Star System data source.

The Actions tab derives Build destinations from the player-view Star System and orders all Sector and Body choices by coordinate.

The SVG map uses each Sector's stored angular range, renders Bodies within their parent Sector, and renders owner-colored Unit stacks at their resolved locations. It transforms one inner content group for pan and zoom. React remains responsible for the rendered map content and fixed controls.
