# Galaxy Creation

The galaxy creation module has a single entry point: `createGalaxy.ts`.

The entry point is deterministic and pure.

## Generation pipeline

1. The [topology generator](topology/galaxyTopologyGenerator.ts) places stars and planets and records each planet’s orbit distance.
2. The [attributes generator](attributes/generateGalaxyAttributes.ts) creates each star and its planets. All planets start unowned.
3. The [home planet generator](home-planets/generateHomePlanets.ts) assigns one unowned planet to each player and returns the playable galaxy.

All three passes use the same seeded random generator.
