# Galaxy Creation

The galaxy creation module has a single entry point: `createGalaxy.ts`.

The entry point is deterministic and pure.

## Generation pipeline

1. The [topology generator](topology/galaxyTopologyGenerator.ts) generates the structure of the galaxy.
2. The [attributes generator](attributes/generateGalaxyAttributes.ts) generates the playable planet attributes.
3. [Sol generation](generateSolSystem.ts) replaces a central procedural system with the Sun and its eight planets.
4. The [home planet generator](home-planets/generateHomePlanets.ts) assigns home planets around the Sun.
5. [Metal deposit generation](generateMetalDeposits.ts) rolls deposits on eligible planets outside Sol and all home systems.

The preview CLI renders procedural topology and attributes separately.

All passes use the same seeded random generator. The last step always returns the playable galaxy.

## Behavioral requirements

This module defines behavioral requirements for its entry point. Every change to the module should include a change in those requirements, with tests covering them.
