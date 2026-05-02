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

## Implementation Plan
