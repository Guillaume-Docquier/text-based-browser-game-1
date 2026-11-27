# Galaxy Creation

The galaxy creation module has a single entry point: `createGalaxy.ts`.

The entry point is deterministic and pure.

## Generation pipeline

The galaxy generation is a pipeline with multiple passes. The first pass generates the topology, aka the positions of stars and planets. It describes the structure of the galaxy, it doesn't define planet attributes.

A second pass takes the topology and turns it into actual playable stars and planets.

More passes can be added as we add features to the galaxy. The goal is that each pass has strict responsibilities, and they can be easily composed and modified independently.
