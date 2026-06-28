# Tick processing (target architecture)

The tick processing pipeline aims to be entirely data driven.

Every game will configure its ruleset, which defines:

- the enabled game mechanics (diplomacy, messaging, war, science, basic income, etc)
- the game mechanics attributes (treaty costs, messaging scope, warship damage multiplier, etc)
- every building, unit, etc, their costs, their stats and the actions they offer
- the order in which mechanics and actions should be resolved
- static game attributes (starting resources, solar system size, action count multiplier, tick rate, etc)

There will be presets for ease of use, but the idea is that every rule will be stored in the DB for each game.

Players will be able to tweak any setting at will.

The tick processing pipeline will:

- take as input the game state and ruleset
- determine non-player actions that will occur
- sort actions in the order that they should occur
- apply actions to the game state
- proceed to next tick

The goal of this is to be able to add / change the game mechanics with minimal changes to the tick processing.

To add a game mechanic, we only have to define the actions that this mechanic has, and implement each action. The rest should fit neatly into the pipeline.

For mechanics that introduce things that are already supported by the game (like new units, new buildings), then there is nothing to implement, just data to add.

Tweaking numbers or the order of actions should require 0 backend changes, only changes to the persisted ruleset.

```mermaid
sequenceDiagram
        participant P3@{ "type": "collections" } as TickProcessor
        participant P4 as processTicks
        participant P1@{ "type": "database" } as GameTicksRepository
        participant P2@{ "type": "database" } as GameStatesRepository
        participant P6@{ "type": "database" } as GameRulesetsRepository
        participant P5 as processTick
        participant P8 as buildTickPlan
        participant P7@{ "type": "collections" } as GameStep
        loop every second
          P3->>P4: call
          P4->>P1: getNextTickToProcess()
          P1->>P4: GameTick | undefined
          alt GameTick found
            P4->>P2: getGameState(gameId, tick)
            P4->>P6: getGameRuleset(gameId)
            P2->>P4: GameState
            P6->>P4: GameRuleset
            P4->>P5: call(gameState, gameRuleset)
            P5->>P8: call(gameRuleset, gameState, playerCommands)
            P8->>P5: Array<GameStep>
            loop foreach GameStep
              P5->>P7: execute(newGameState)
            end
            P5->>P4: newGameState
            P4->>P2: insert(newGameState)
            P4->>P1: insert(newTick)
          end
          P4->>P3: void
        end
```
