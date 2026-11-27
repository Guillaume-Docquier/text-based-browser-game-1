# Galaxy Creation

The galaxy creation module has a single entry point: `createGalaxy.ts`.

The entry point is deterministic and pure.

## Generation pipeline

1. The [topology generator](topology/galaxyTopologyGenerator.ts) generates the structure of the galaxy.
2. The [attributes generator](attributes/generateGalaxyAttributes.ts) generates the playable planet attributes.
3. The [home planet generator](home-planets/generateHomePlanets.ts) assigns home planets for each player.

All passes use the same seeded random generator. The last step always returns the playable galaxy.
