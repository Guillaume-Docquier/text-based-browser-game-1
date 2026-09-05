# Turn processing (target architecture)

The turn processing pipeline aims to be entirely data driven.

Every game will configure its ruleset, which defines:

- the enabled game mechanics (diplomacy, messaging, war, science, basic income, etc)
- the game mechanics attributes (treaty costs, messaging scope, warship damage multiplier, etc)
- every building, unit, etc, their costs, their stats and the actions they offer
- the order in which mechanics and actions should be resolved
- static game attributes (starting resources, solar system size, action count multiplier, turn rate, etc)

There will be presets for ease of use, but the idea is that every rule will be stored in the DB for each game.

Players will be able to tweak any setting at will.

The turn processing pipeline will:

- take as input the current Turn state and ruleset
- determine non-player actions that will occur
- sort actions in the order that they should occur
- apply actions to the game state
- proceed to next turn

The goal of this is to be able to add / change the game mechanics with minimal changes to the turn processing.

To add a game mechanic, we only have to define the actions that this mechanic has, and implement each action. The rest should fit neatly into the pipeline.

For mechanics that introduce things that are already supported by the game (like new units, new buildings), then there is nothing to implement, just data to add.

Tweaking numbers or the order of actions should require 0 backend changes, only changes to the persisted ruleset.

```mermaid
sequenceDiagram
        participant P3 as TurnProcessor
        participant P1@{ "type": "database" } as TurnsRepository
        participant P2@{ "type": "collections" } as resolveTurn
        loop every worker check
          P3->>P1: promote expired collecting Turns
          P3->>P1: claim queued AWAITING_PROCESSING Turn
          alt Turn found
            P1->>P3: locked Turn state and processing row
            P3->>P2: resolve locked submissions
            P2->>P3: processed Turn and next state
            P3->>P1: complete current Turn
            P3->>P1: insert next Turn and processing row
          end
        end
```
