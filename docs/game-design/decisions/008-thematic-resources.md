# Thematic Resources

## Status

Partially Implemented

- [x] Resource catalogue and empire stockpiles
- [x] Action costs and gains
- [ ] Resource production and scarcity
- [ ] Resource uses and balance

## Context

A single abstract economy would make empire development and strategic choices too uniform. The game needs resources that create different needs, opportunities, and interactions between empires.

## Decision

The game will use multiple distinct, thematic resources rather than one generic resource. The current catalogue is Influence, Metal, Fuel, Energy, and Colony. The catalogue will evolve as the game develops.

Resources will have different production methods and uses. Their availability may depend on Planet attributes, geography, and Ideological Alignment. Advanced or extreme Alignments may give an empire much stronger access to particular resources, while a balanced empire may only obtain them slowly, situationally, or not at all from its own territory.

Alignment controls production and Action availability, not ownership of a resource. Once an empire acquires a resource, it may hold and spend it normally where the relevant Action permits. This lets empires stockpile a resource before changing Alignment or use a scarce resource to trade for one they need.

Resource design should support distinct empire archetypes: for example, some resources may better support military expansion, ecological development, colonization, trade, or contracts.

## Pros

- Gives empire development and specialization concrete economic expression
- Creates reasons to trade, make contracts, and interact with other empires
- Supports varied strategic archetypes without making any one resource universally best
- Makes resources meaningful parts of the game's fiction and player fantasy

## Cons

- Adds economic complexity and balance work
- Poor availability or communication can leave players feeling unfairly resource-starved
- Requires clear presentation of resource sources, uses, scarcity, and alignment relationships
