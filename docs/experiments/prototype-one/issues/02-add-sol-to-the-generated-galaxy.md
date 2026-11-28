# Heirs of Sol Prototype 1 · 02/26 · Add Sol to the generated galaxy

Agent: Codex gpt-6.2-astra high

## Description

Every match takes place in a different galaxy, but players share the Sun as the destination for Dyson swarm deliveries. Put a recognizable Solar System into the generated galaxy so a player can find Sol in the galaxy view, open its system view, and identify the Sun and its planets. Public coordinates give players a way to refer to that same destination when movement and delivery arrive. All home worlds will use Sol as the center point instead of the center of the galaxy. The Sol system will be choosen at random around the center of the galaxy. We introduce a new Gas biome to support saturn and jupiter.

## Implementation order

2 of 26

## Direct dependencies

[ticket 01](01-assign-prototype-home-worlds.md)

## Acceptance criteria

- A random system within 5 LY of the galaxy center is chosen and replaced with a Sol system during galaxy generation.
- The Sol system contains the sun, mercury as small metallic, venus as small volcanic, earth as small oceanic, mars as small volcanic, jupiter as large gas, saturn as large gas, uranus as medium icy and neptune as medium icy. Their orbits should match the real orbit distances, assuming circle orbits.
- Home systems now use Sol as the center point around which to spread out during galaxy generation.
- Players can identify Sol, the Sun, and the familiar Solar System planets on the existing maps. In the galaxy view, the Sun has 1.5x radius of other stars, is orange and has a small halo.
- Every planet in the solar system, and the sun, has its real name and its own unique art
- There is a new gas biome, with art
