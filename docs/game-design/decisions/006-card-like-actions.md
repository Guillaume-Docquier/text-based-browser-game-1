# Card-like Actions

## Status

Partially Implemented

- [x] Card-like Action Definitions
- [x] Per-Turn Available Action pool
- [ ] Multiple Action selection
- [ ] Ideology-driven Action pools

## Context

If the game is deep, discovering what is possible might become hard.

We also want ideological axes to drive which actions are available to the player based on alignment.

## Decision

All actions will fit the "card" model, where an action:

- has type(s)
- has prerequisite(s)
- has cost(s)
- has effect(s)
- etc

Every turn, the player will have an Action pool.

- Having access to multiple trade actions will mean a player can perform multiple trades.
- Having access to a strong move action might mean the ships can move far, or fast, or stealthily, etc.

Even if the Action is in the pool, players will have to meet certain prerequisites and be able to pay the Action's costs in order to submit it, which means they won't be able to play all the actions every turn. They will have to choose.

## Pros

- Can easily model a weaker/stronger version of an action
- Can easily explain mechanics, then mix and match them
- Can leverage rarity to hint at the action's power
- Player will have to make choices of which actions to play
- Having access to multiples of the same Action can be a real upside
- Easy to explore existing actions via a codex
- Easy to add new cards if the underlying mechanics are implemented
- Players can make their own cards
- Seems original for a space browser strategy game

## Cons

- Some unique actions might be hard to model as cards
- The Action pool every turn might be very big and hard to display properly
