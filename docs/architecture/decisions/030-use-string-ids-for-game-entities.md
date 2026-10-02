# Use String IDs for Game Entities

## Status

Accepted

### Amendment history

- 2026-10-01: Clarified that this decision applies to entities within a game. The identifier for the game itself (`GameId`) is outside this decision and may remain numeric.

## Context

IDs for entities within a game are used across persistence, game logic, API contracts, and the frontend. These IDs cross a serialization boundary before reaching the frontend. Allowing numeric IDs in some places and string IDs in others requires conversions and makes references to the same entity less consistent across the system.

Numeric IDs are a possible representation, but their compactness does not outweigh the cost of maintaining two representations as an ID moves through the application.

## Decision

Represent every ID for an entity within a game as a string throughout the system, including persisted values, backend models, API contracts, and frontend code. Do not use numbers as IDs for entities within a game. The identifier for the game itself (`GameId`) is excluded and may be numeric. This applies to existing and future in-game entity types; it does not prescribe how string IDs are generated or formatted.

## Consequences

Entity references have one consistent representation across layers, and serialization does not require converting numeric IDs to strings for frontend use. New entity types follow the same convention without choosing an ID representation separately.

Existing numeric IDs for entities within a game and their persistence, parsing, and usage must be changed to strings where needed. String IDs can occupy more storage than numeric IDs, and code that relies on numeric ordering or arithmetic for entity IDs must use a separate value for that purpose.
