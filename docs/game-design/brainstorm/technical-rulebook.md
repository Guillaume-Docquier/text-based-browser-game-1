# Purpose and Editing Workflow

I call this document a "technical" rulebook, because it will look a lot like a rulebook, but it won't be suitable for teaching players how to play. It will include quite a bit of information that will be necessary for implementation rather than for learning. I'm writing this document as a rulebook because I believe teaching or explaining a game is a good way to express the constraints of the game and identify missing rules and interactions. I plan on using AI to implement the game based on the technical rulebook, and I am hoping that the teaching part will help provide context on how the game is played and should feel like. Afterward, I will use the technical rulebook as the living spec for the game and I will probably derive the actual rulebook from it, removing the unnecessary implementation details and probably preferring an HTML version. I fully expect the format of the technical rulebook to change over time, this is already the 3rd version of it.

The important parts of the technical rulebook will be:

- Learning via gradual discovery, starting with a wide view and then diving into specifics.
- A linear narrative as much as possible. We'll inevitably need cross-references or looping concepts.
- A set of strictly defined scenarios for each mechanic that will become enforced test cases. This will be super important to validate the implementation.

## Active Voice

[Active voice](https://www.grammarly.com/blog/sentences/active-vs-passive-voice/) should be preferred over Passive voice. Only use Passive voice when it makes the explanation clearer.

## Consistent Vocabulary

Always use the same term to talk about the same concept. If two terms define the same concept, we choose one and stick with it. Capitalize those terms when used in the context of their game meaning. For example:

- Whenever a Fleet Moves, it must have a valid destination. ("moves" is used as a game concept)
- After Resolution, the game moves to the next Turn. ("moves" is not used as a game concept)

A glossary should define all the game specific terms and concepts for an easy reference.

## Scenarios

Scenarios are implementation requirements in disguise. For the technical rulebook, list ALL the scenarios to accurately define mechanics and their interactions. In the actual rulebook, we will keep only the edge case ones to support the mechanic explanation.

A scenario is written as a table row, with columns "Action(s)", "Scenario", "Intent" and "Outcome":

- Action(s) identifies the Action being tested to understand which Effects are involved.
- Scenario describes the starting game state.
- Intent states the rule or behavior the scenario aims to cover, the scenario's purpose.
- Outcome describes what happens and the expected resulting game state.

Each Scenario covers exactly one Turn. The starting state can include an Action or Effect already in progress to cover behavior across multiple Turns. A row does not need to describe the prior Turns, the Scenario should be self-contained.

Scenarios are grouped together to form a linear narrative. For example, a multi turn Action could have the following scenario intents:

- Submitting a valid Action, resolving the first Turn
- Starting with an Ongoing Action, resolving the second Turn
- Starting with an Ongoing Action, Completing it during resolution.
- Submitting an invalid Action for reason 1, it is rejected and does not resolve
- Submitting an invalid Action for reason 2, it is rejected and does not resolve
- etc

## Inspiration

- https://resonym.com/writing-rulebooks/
- https://entrogames.substack.com/p/how-to-write-a-rulebook-for-your-board-game

## AI Guidance

The main content states established rules. Put unresolved questions and provisional notes only in To Do, Problems, or Thoughts dump.

Editing is collaborative. Understand the human's intended meaning and identify gaps and ambiguities. Discuss unresolved game-design choices before making changes that depend on them; do not infer missing decisions from existing prose. Record clarified intent here so later agents have the context.

# Table of Contents

- Learning the Game
  - Setting
  - Goal & Game End
  - Starting a game
  - The First Turn
  - Structure of a Turn
  - Actions
  - Ideological Alignments
  - Effects
  - Galaxy
  - Fleets
  - Customize your Game
  - Quick Reference
- Rules Reference (by domain)
  - Movement
  - Combat
  - Planets
  - Legacy
- Glossary (by domain)
  - Movement
  - Combat
  - Planets
  - Legacy
- Architecture Constraints
  - API vs Turn Resolution
  - Data Driven Ruleset
  - Generated frontend
  - Shared Validation Rules
- Ideas (as I write this document)

# Learning the Game

## Setting

After the Sun mysteriously began to fade, leading to a global freeze, humans were forced to leave Earth. There was no time to find a planet certain to sustain life, nor could enough ships be built to save everyone. In a desperate attempt to ensure humanity's survival, hundreds of small expeditions were launched across the galaxy. Only sixteen found habitable worlds. One of them was yours.

## Goal & Game End

In Heirs of Sol, you control one of the surviving Earth expeditions. You must grow your new homeworld into an empire that will be remembered. The goal is to gain Legacy Points by having an impact on the galaxy. Extract Resources, Build Fleets, Colonize Planets, Trade, perform Contracts and achieve the ultimate Legacy Projects to bring back humanity to what it once was.

Heirs of Sol is an asynchronous turn based game that requires no coordination to play your turn. Check in once per day when you can, submit your Actions, and wait for the turn to resolve. Games have a predetermined fixed duration, either in time or number of turns. The player with the most Legacy Points at the end of the game wins.

## Starting a game

A game can be played with 2 to 16 players. To create a game, you must:

- choose the maximum number of players you'd like to play with
- choose a turn length, in minutes, hours or days
- choose the game's duration by setting an end date, a maximum number of turns, or both
- choose a galaxy generation preset
- choose a Ruleset

Then, you wait for players to join your game. Once you are satisfied with the number of players that have joined, you can start the game, revealing the galaxy. Players cannot join or leave this game after it has started.

## Structure of a Turn

During a turn, you will choose and submit Actions. An Action will list the following:

- Name
- Tier
- Costs
- Effects
- Targets
- Inputs

If you can pay the Costs, you can submit the Action. There is no limit to how many Actions you can play, as long as you can pay for it. Everything you do in the game is done via submitting an Action, and all Actions of all players resolve at the end of the turn. You can change your Action submissions without penalty before the end of the turn.

A turn a very simple:

- Submit Actions
- Lock-In (optional)
- Turn ends and Actions resolve

The turn ends either when its duration chosen before starting the game expires or when all players have Locked-In.

Action submissions are secret. You cannot see what other players will submit or have submitted. You will, however, see the Effect outcomes that affected you. A turn log will list everything that happened that you can perceive. You will know if a player traded with you, you will receive battle reports, you will be notified of players that colonized planets in your scan range, etc.

## The First Turn

The first turn is slightly different from the following turns. The most important difference is that the first turn has no set duration. All players must Lock-In for the first turn to resolve, then the game will progress normally.

In your first turn, you will also get to choose your starting political Regime. Your political Regime will influence your options throughout the game. The impact of your chosen Regime ranges from modifying your Effects magnitudes and Costs, to fundamentally changing how you interact with Ideological Alignments. Don't worry, you can change your Regime during the game, and they are all viable options to start with.

Once you have chosen your Regime, you'll be able to see your starting Planet and its surroundings. It is very unlikely that you'll see another player from the start. You'll probably encounter them after a few turns when you start exploring.

You can submit your turn's actions as in the normal turn structure. Remember that you must Lock-In, or the first turn will never resolve!

## Actions

## Ideological Alignments

## Effects

## Galaxy

## Fleets

## Customize your Game

## Quick Reference

# Rules Reference

# Glossary

| Term                   | Description                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Legacy Point           | The player with the most Legacy Points at the end of the game wins.                                                            |
| (Political) Regime     |                                                                                                                                |
| (Ideological) Aligment |                                                                                                                                |
| Lock-In                | Locking in a turn prevent you from changing your actions, and when all players are locked-in, the turn resolves automatically. |
| Action                 |                                                                                                                                |
| Effect                 |                                                                                                                                |
| Cost                   |                                                                                                                                |

# Architecture Constraints

# Ideas

- Include the Solar System with a Frozen Earth and a faded / dead Sun, with a victory path of making Earth viable again and repopulating it.
- Start around the Solar System, not around the galaxy center, so that it makes sense that all players start the game at the same time (same travel distances from Earth).

# <<<--- Old stuff below --->>>

# Glossary

| Term                | Definition                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruleset             | An immutable player authored set of rules for a game. It contains all the action definitions for that game. It is known before game starts.                                                                             |
| Action Definition   | A player authored composition of Effects, with Requirements and Conditions.                                                                                                                                             |
| Effect Definition   | An engine owned game mechanic, with Requirements and Conditions.                                                                                                                                                        |
| Action              | An instance of an Action Definition.                                                                                                                                                                                    |
| Multi-Turn Action   | A Multi-Turn Action is submitted once, paying costs once, and cannot be resubmitted until all Multi-Turn Effects are Ended. A Multi-Turn Action can be canceled by The Player. Cancellation may have Costs and Effects. |
| Effect              | An instance of an Effect Definition.                                                                                                                                                                                    |
| Multi-Turn Effect   | A Multi-Turn Effect happens over multiple turns. Certain events can Cancel an Effect, like a fleet being destroyed, but The Player cannot Cancel a single Effect directly.                                              |
| Requirement         | Something that must be true when the Action is submitted. Effects often have their own Requirements.                                                                                                                    |
| Condition           | Something that must be true when the Effect resolves.                                                                                                                                                                   |
| Status              | A persistent Buff/Debuff/State that applies to an Entity.                                                                                                                                                               |
| Entity              | Something that can be affected by an Action. Planet, Fleet and Player.                                                                                                                                                  |
| Turn                | A full Action Submission + Effect Resolution game loop. Turns have a fixed duration decided before the start of the game.                                                                                               |
| The Player          | The current Player.                                                                                                                                                                                                     |
| Opponent            | Any other Player in the game.                                                                                                                                                                                           |
| Fleet               | A Player's Strength at a location. At a Planet, there is one Fleet per Player; Fleets from different Players can coexist.                                                                                               |
| Strength            | A Fleet's Strength is always an integer.                                                                                                                                                                                |
| Strength commitment | A fixed whole-number amount or All assigned from a Fleet to an Action.                                                                                                                                                  |
| Distance            | A Distance, in Light Years (LY).                                                                                                                                                                                        |
| Speed               | A Distance per Turn.                                                                                                                                                                                                    |

# Submission Validation

| Submission validation result | Description                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Valid                        | All targets and inputs satisfy their constraints.                                                                   |
| Undetermined                 | The submission is missing data to determine if it is valid, such as other targets that contraints need to evaluate. |
| Invalid                      | Some targets or inputs do not satisfy some of their constraints.                                                    |
| Already Active               | The Action is Multi-Turn, was submitted in a previous Turn and is still ongoing.                                    |
| Error                        | Something went wrong during validation. This is unexpected.                                                         |

# Entity Statuses

| Status     | Description                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger    | A Trigger is a category of Buffs that causes an Effect to Resolve when a condition is met. The same Trigger can be triggered multiple times. A Trigger can be canceled by another Effect. |
| Stationed  | A Fleet is Stationed when it is on a planet.                                                                                                                                              |
| In Transit | A Fleet is In Transit when it has departed from an origin Planet and has not yet arrived to its destination Planet                                                                        |
| Moving     | A Fleet is Moving when its Transit is progressing.                                                                                                                                        |
| Pinned     | A Pinned Fleet cannot start or progress a Transit. An existing Transit is paused, but remains active.                                                                                     |
| Destroyed  | A Fleet reduced to 0 Strength by losses.                                                                                                                                                  |

| Trigger    | Notation          | Description                                        |
| ---------- | ----------------- | -------------------------------------------------- |
| On Arrival | OnArrival(Effect) | Causes an Effect when a Fleet arrives at a Planet. |

# Effects

| Effect Lifecycle | Description                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Ongoing          | The Effect is not done resolving and will continue on subsequent Turns.                  |
| Completed        | The Effect is Ended after its full resolution and will not continue on subsequent Turns. |
| Canceled         | The Effect is Ended early and will not continue on subsequent Turns.                     |

| Effect Outcome | Description                                                                          |
| -------------- | ------------------------------------------------------------------------------------ |
| Progressed     | The Effect resolved and stays Ongoing                                                |
| Prevented      | The Effect could not resolve because some conditions were not met and stays Ongoing. |
| Completed      | The Effect resolved and moves to Completed.                                          |
| Canceled       | The Effect did not resolve and moves to Canceled.                                    |
| Error          | Something went wrong during resolution. This is unexpected.                          |

| Effect        | Phase            | Notation                                                  | Ruling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Targets                  | Inputs                    | Requirements                                                                                                           | Conditions                                                                 | Multi-turn |
| ------------- | ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- |
| Move          | Fleet Movement   | Move(Fleet, DestinationPlanet, Distance, Speed, Strength) | The committed [Strength], or the remaining available Strength if less, starts a Transit from [Fleet] to [DestinationPlanet] within [Distance] LY at Speed [Speed]. Partial movement splits off a Fleet without inherited Statuses; whole-Fleet movement retains its Statuses without a split. An ongoing Move progresses with its moving Fleet's remaining positive Strength. A Move is Canceled if no Strength remains available for it or the Fleet needed to resolve it is Destroyed. | Fleet, DestinationPlanet | Distance, Speed, Strength | Own [Fleet], Stationed, [Fleet] is within [Distance] of [DestinationPlanet], Can Move, Sufficient uncommitted Strength | Own [Fleet], [Fleet] is within [Distance] of [DestinationPlanet], Can Move | Yes        |
| Assault       | Fleet Combat     | Assault(Fleet, NbTurns)                                   | Assault commits All: [Fleet]'s entire Strength at resolution attacks all other Fleets Stationed on the Planet. Repeats every Turn for [Repeats] Turns.                                                                                                                                                                                                                                                                                                                                   | Fleet                    | Repeats                   | Own [Fleet], Stationed, Sufficient uncommitted Strength                                                                | Own [Fleet], Stationed                                                     | Yes        |
| Pin           | Tactics          | Pin(Fleet, NbTurns, Repeats)                              | Pins [Fleet] for [NbTurns] Turns. Repeats every Turn for [Repeats] Turns.                                                                                                                                                                                                                                                                                                                                                                                                                | Fleet                    | NbTurns, Repeats          | -                                                                                                                      | -                                                                          | Yes        |
| Colonize      | Colonization     | Colonize(Fleet, Planet)                                   | [Fleet] claims [Planet].                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Fleet, Planet            | -                         | Unclaimed [Planet], [Fleet] Stationed on [Planet]                                                                      | Unclaimed [Planet], [Fleet] Stationed on [Planet]                          | No         |
| Produce Fleet | Fleet Production | Fleet(Strength, Planet)                                   | Create a Fleet of [Strength] on [Planet]. If a Fleet is already present, it is reinforced instead. Repeats every Turn for [Repeats] Turns.                                                                                                                                                                                                                                                                                                                                               | Planet                   | Strength, Repeats         | -                                                                                                                      | -                                                                          | Yes        |

Note: When [NbTurns] is 1, the text rules won't mention it.

# In Depth Mechanics

## Ruleset

A Ruleset defines all the rules for a game. Every value can be customized. Cosmic Empire will provide core Rulesets, but players will be able to author their own.

The Ruleset allows players to define the set of Actions available for play by combining Effects, Statuses, Requirements and Conditions. Phase ordering is fixed.

Some Effects have their own Requirements and Conditions. They cannot be overridden. However, Actions can define additional requirements and conditions, and can define the values for each Effect, such as the Movement max Distance and Speed. They can choose fixed values or let the user choose when they submit.

## Fleets

Fleets belonging to the same Player at a Planet/location merge automatically into one Fleet. Merging combines their Strength and carries all their Statuses over to the resulting Fleet. This includes On Arrival triggers, Pin from either Fleet, statuses gained during Transit, etc. Fleets belonging to different Players can coexist there. Fleets never merge while In Transit. Move can split a Player's Fleet by Strength.

When only part of a Fleet moves, the split-off Fleet inherits none of the source Fleet's Statuses, including buffs, harmful Statuses, and triggers. The source Fleet retains its Statuses. When the entire Fleet actually moves, no split occurs and its Statuses remain with it. This also applies when a fixed commitment moves the whole remaining Fleet, rather than using All.

Status inheritance is separate from an Action assigning Statuses or triggers. The splitting rule does not remove Invasion's explicitly assigned Assault On Arrival trigger.

When an Invasion Fleet merges on arrival, its Assault On Arrival trigger transfers to the resulting Fleet. The triggered Assault uses that Player's entire combined Fleet Strength at combat resolution. A Pin carried over from the Stationed Fleet leaves the merged Fleet Pinned; Pin blocks movement and does not prevent Assault.

## Fleet destruction

A Fleet is Destroyed when it loses all its Strength. Moving or allocating all of a Fleet's Strength does not count as destruction. A Destroyed Fleet cannot participate in further Action resolution. Any remaining Effect resolution requiring that Fleet is canceled.

Resolution already performed retains its outcome. Destruction after an intermediate Assault repetition cancels the remaining repetitions. A final Assault repetition that resolves can complete even if that combat destroys the attacker.

## Strength commitments

Most Actions involving Fleets will need to Commit Strength to the Action. To be able to Commit Strength, the Fleet must have enough uncommitted Strength.

A Strength commitment is a fixed whole-number amount or "All". "All" means the entirety of the Fleet and uses its Strength at resolution. Its numeric amount is not recorded at submission.

Submission Validation requires sufficient uncommitted Strength for the Action's commitment. If it is insufficient, the submission is rejected and creates no Effect. This requirement applies to Strength commitments generally. "All" requires the full Fleet to be uncommitted; it cannot select only the Strength left uncommitted after other submissions.

After validation succeeds, resolution attempts to satisfy the commitment. If the requested amount is no longer available and positive Strength remains, resolution uses that remaining available Strength. A reduction to a positive amount does not by itself prevent resolution unless there is a specific Condition set by the Action or Effect.

## Move

Each Move specifies a Strength commitment. Selecting or submitting Move does not split the Fleet. When the Turn resolves, the Move uses the committed Strength or the remaining available Strength if less. If only part of the Fleet moves, that Strength splits off and the rest remains at the origin. If the entire Fleet moves, it departs without splitting. An ongoing Move progresses with its moving Fleet's remaining positive Strength; it does not split the source again each Turn or require restoration of its initial Strength. A Move is canceled when its source Fleet is Destroyed.

The ruleset author can set a fixed whole-number amount, such as exactly 10 Strength, or All. Alternatively, The Player selects a whole-number amount or All as allowed by the Action. The Action can constrain the amount, such as between 10 and 20 Strength or any available whole-number amount.

Multiple Move submissions can use the same origin Fleet in one Turn. They resolve from smallest commitment to largest to fulfill as many Moves as possible. Equal commitments are ordered using random numbers from the game's pseudorandom number generator. Submission order does not affect priority, and Players cannot specify a resolution order. Each Move attempts its requested amount and uses a smaller positive amount if that is all that remains available when it resolves. Once no Strength remains available, the remaining Moves are Canceled. Strength already allocated to earlier Moves continues moving.

For example, from 100 Strength, commitments of 30 and 40 send 30 and 40 Strength to separate destinations and leave 30 Strength at the origin. If commitments of 3, 5, and 7 validate against 15 Strength but only 6 remains before movement, the Move for 3 receives 3, the Move for 5 receives the remaining 3, and the Move for 7 is Canceled.

For a fixed commitment of 10 Strength, Submission Validation requires 10 uncommitted Strength. If validation succeeds and other Effects later reduce the available Strength to 8 before movement, those 8 Strength moves. There is no insufficient-Strength failure at resolution for this positive remainder.

## Assault

Assault always commits All. All of the Fleet's Strength at resolution participates in combat, including Strength gained since submission. It is not a fixed amount recorded at submission.

Assault requires sufficient uncommitted Strength for its All commitment. After Assault is submitted, no uncommitted Strength remains to satisfy a Move commitment. If a partial Move is submitted first, the remaining uncommitted Strength cannot satisfy Assault's All commitment. Both submissions follow the same Strength availability requirement.

# Phases

Turn resolution is entirely deterministic: the same starting game state, including the pseudorandom generator state, and the same Actions reproduce the same resolution result. The generator state progresses as numbers are drawn and is persisted across Turns.

Regular phases resolve in the order listed below. Tactics is a special phase that runs immediately after each regular phase, including Pay Costs and the final phase, Colonization.

Pin resolves during the Tactics phase. An Action's initial Pin resolves during the Tactics phase after Pay Costs, before Fleet Movement. A Pin generated during Fleet Combat resolves during the Tactics phase immediately after Fleet Combat.

| Name             | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| Pay Costs        | Validate and apply the costs committed by locked Action Submissions. |
| Fleet Movement   | Resolve Fleet movements and triggers arrivals.                       |
| Fleet Production | Resolve Fleet production on Planets.                                 |
| Fleet Combat     | Resolve all combats.                                                 |
| Colonization     | Resolve attempts to claim Unclaimed Planets.                         |

# Sample Actions

Inputs lists player-supplied Action inputs. The Strength input is passed to the Move Effect; fixed commitments come from the Action definition.

| Name             | Description                                                                                                                                         | Inputs                                | Effects                                                  | Requirements | Conditions | Notes                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- | ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repeated Assault | Your [Fleet] commits All to Assault for 5 Turns.                                                                                                    | -                                     | Assault(F, 5)                                            | -            | -          | All uses the Fleet's entire Strength at resolution.                                                                                                                                                    |
| Travel           | The Player selects [Strength] under the Action's constraints to Move from [Fleet] to target [Planet] within 100 LY at Speed 10.                     | Strength (whole-number amount or All) | Move(F, P, 100, 10, Strength)                            | -            | -          | -                                                                                                                                                                                                      |
| Invasion         | The Player selects [Strength] under the Action's constraints to Move from [Fleet] to target [Planet] within 100 LY at Speed 10. Assault On Arrival. | Strength (whole-number amount or All) | Move(F, P, 100, 10, Strength), OnArrival(Assault(FA, 1)) | -            | -          | `FA` refers to the arriving Fleet, or the resulting merged Fleet when it joins a friendly Fleet at the destination. Assault On Arrival uses the combined Fleet's entire Strength at combat resolution. |
| Fixed Travel     | Commit exactly 10 Strength from your [Fleet] to Move to target [Planet] within 100 LY at Speed 10.                                                  | -                                     | Move(F, P, 100, 10, 10)                                  | -            | -          | -                                                                                                                                                                                                      |
| Full Travel      | Move your [Fleet] with an All commitment to target [Planet] within 100 LY at Speed 10.                                                              | -                                     | Move(F, P, 100, 10, All)                                 | -            | -          | All uses the Fleet's entire Strength at resolution.                                                                                                                                                    |
| Limited Travel   | The Player selects between 10 and 20 Strength to Move from [Fleet] to target [Planet] within 100 LY at Speed 10.                                    | Strength (10 to 20)                   | Move(F, P, 100, 10, Strength)                            | -            | -          | -                                                                                                                                                                                                      |

# Scenarios

| Action(s)                      | Scenario                                                                                                                                                                                                                                                                                                                                                                                       | Intent                                                                                         | Outcome                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repeated Assault               | Submitting Assault for a Stationed Fleet with no other Fleets on Planet                                                                                                                                                                                                                                                                                                                        | Start a Multi-Turn Effect.                                                                     | No combat occurs and Fleet Strength does not change. The Fleet remains Stationed. One Assault repetition is consumed; [Repeats] minus one repetitions remain and the Assault stays Ongoing.                                                                                                                                                                                                            |
| Repeated Assault               | Last Turn of an Assault for a Stationed Fleet with no other Fleets on Planet                                                                                                                                                                                                                                                                                                                   | Complete a Multi-Turn Effect.                                                                  | No combat occurs and Fleet Strength does not change. The Fleet remains Stationed. The final Assault repetition is consumed and the Assault completes.                                                                                                                                                                                                                                                  |
| Repeated Assault               | Submitting Assault for a Fleet In Transit                                                                                                                                                                                                                                                                                                                                                      | Enforce the Stationed Requirement.                                                             | Submission is rejected because the Fleet is In Transit. This Action causes no combat and does not change the existing Transit.                                                                                                                                                                                                                                                                         |
| Repeated Assault               | An intermediate Turn of an Assault for a Stationed Fleet with a stronger opposing Fleet on Planet                                                                                                                                                                                                                                                                                              | Cancel an Ongoing Effect after its Fleet is Destroyed.                                         | The Fleets exchange damage. The attacking Fleet is Destroyed; the opposing Fleet survives with its Strength reduced by the attacker's Strength before combat. The current Assault repetition resolves with outcome Progressed, then the Assault is Canceled because the attacker was Destroyed. No remaining repetitions occur.                                                                        |
| Repeated Assault               | Last Turn of an Assault for a Stationed Fleet with a stronger opposing Fleet on Planet                                                                                                                                                                                                                                                                                                         | Complete the final repetition despite Fleet destruction.                                       | The Fleets exchange damage. The attacking Fleet is Destroyed; the opposing Fleet survives with its Strength reduced by the attacker's Strength before combat. The final Assault repetition resolves and the Assault completes because no repetitions remain.                                                                                                                                           |
| Repeated Assault               | The final Turn of an ongoing Assault, submitted when the Fleet had 20 Strength. At combat resolution it has 30 Strength and the only other Fleet on the Planet is an Opponent's Fleet of 50 Strength.                                                                                                                                                                                          | Commit all current Strength to combat rather than a submission-time amount.                    | All 30 Strength participates. The Fleets exchange damage: the attacking Fleet is Destroyed and the Opponent's Fleet survives with 20 Strength. The final Assault repetition resolves and the Assault completes.                                                                                                                                                                                        |
| Repeated Assault               | The final Turn of an ongoing Assault that commits All. The Fleet has 20 Strength at the start of the Turn and reaches 0 Strength before this Turn's Assault repetition resolves.                                                                                                                                                                                                               | Cancel resolution that requires a Fleet already Destroyed.                                     | The Fleet is Destroyed and the Assault is Canceled. The final repetition does not resolve or complete. This Assault causes no attack or damage this Turn.                                                                                                                                                                                                                                              |
| Travel                         | Submitting Move with an All commitment for a Fleet Stationed at [Distance] from the destination, with more than one Turn of travel required                                                                                                                                                                                                                                                    | Accept the Distance limit and start a Multi-Turn Move.                                         | The Fleet departs and travels at [Speed] toward the destination for one Turn. It remains In Transit with [Distance] minus the distance covered this Turn remaining. The Move stays Ongoing.                                                                                                                                                                                                            |
| Travel                         | Submitting Move with an All commitment for a Fleet Stationed at 1 Turn range of the destination                                                                                                                                                                                                                                                                                                | Complete a Multi-Turn Effect on its first resolution.                                          | The Fleet covers the remaining distance at [Speed] and becomes Stationed on the destination Planet this Turn. The Transit ends and the Move completes.                                                                                                                                                                                                                                                 |
| Travel                         | Submitting Move with an All commitment for a Fleet Stationed on the destination Planet                                                                                                                                                                                                                                                                                                         | Complete Move without travel.                                                                  | The Fleet remains Stationed on the destination Planet. No distance is traveled and no Transit is needed. The Move completes.                                                                                                                                                                                                                                                                           |
| Travel                         | Submitting Move with an All commitment for a Fleet Stationed too far from the destination                                                                                                                                                                                                                                                                                                      | Enforce the Distance Requirement.                                                              | Submission is rejected because the destination is beyond the Move's [Distance] limit. The Fleet remains Stationed at its origin and no Transit starts.                                                                                                                                                                                                                                                 |
| Travel                         | Submitting Move with an All commitment for a Pinned, Stationed Fleet                                                                                                                                                                                                                                                                                                                           | Pin blocks the Can Move Requirement.                                                           | Submission is rejected because the Fleet is already Pinned. The Fleet remains Stationed and no Transit starts.                                                                                                                                                                                                                                                                                         |
| Travel                         | An ongoing Move that began with an All commitment. Its moving Fleet is Pinned and In Transit.                                                                                                                                                                                                                                                                                                  | Pin fails the Can Move Condition and pauses an Ongoing Move.                                   | The Fleet makes no movement progress. It remains In Transit toward the same destination with the same remaining distance. The Move stays Ongoing and can resume on a later Turn when the Fleet is no longer Pinned.                                                                                                                                                                                    |
| Travel                         | An ongoing Move that began with an All commitment. Its moving Fleet is In Transit with more Distance remaining than the Speed.                                                                                                                                                                                                                                                                 | Progress a Multi-Turn Effect on a later Turn.                                                  | The Fleet travels at [Speed] toward the destination for one Turn. Its remaining distance decreases by the distance covered this Turn. It remains In Transit and the Move stays Ongoing.                                                                                                                                                                                                                |
| Travel                         | An ongoing Move that began with an All commitment. Its moving Fleet is In Transit at 1 Turn range of the destination.                                                                                                                                                                                                                                                                          | Complete a Multi-Turn Move on a later Turn.                                                    | The Fleet covers the remaining distance at [Speed] and becomes Stationed on the destination Planet this Turn. The Transit ends and the Move completes.                                                                                                                                                                                                                                                 |
| Travel                         | Submitting a new Move with an All commitment for a Fleet already In Transit via another Move Effect. The existing Move began with an All commitment from its source Fleet and continues with its current moving Fleet.                                                                                                                                                                         | An existing Transit blocks a new Move through the Stationed Requirement.                       | The new submission is rejected because another Move already controls the Fleet's Transit. It does not replace or cancel the existing Move, which resolves normally.                                                                                                                                                                                                                                    |
| Travel                         | Submitting Move with an All commitment for a Stationed Fleet that an Opponent also targets with a submitted Action containing Pin on the same Turn                                                                                                                                                                                                                                             | An unseen Pin cancels departure during resolution.                                             | The Opponent's Pin resolves during the Tactics phase after Pay Costs, before Fleet Movement. The Fleet remains Stationed at its origin, no Transit starts, and the new Move is canceled.                                                                                                                                                                                                               |
| Travel                         | Submitting Move with an All commitment for a Stationed Fleet that The Player also targets with a submitted Action containing Pin on the same Turn                                                                                                                                                                                                                                              | A known Pin conflict warns without rejecting submission.                                       | The Player sees a warning about the conflicting Pin. If both Actions remain submitted, Pin resolves during the Tactics phase after Pay Costs, before Fleet Movement: the Fleet remains Stationed at its origin, no Transit starts, and the new Move is canceled.                                                                                                                                       |
| Travel                         | An All Move passes Submission Validation with all 100 Strength of its source Fleet uncommitted. The Fleet has 80 Strength when the Move resolves. The Action permits All, more than one Turn of travel is required, and all other Move Conditions hold.                                                                                                                                        | Use the Fleet's Strength at resolution for All.                                                | All 80 Strength begins movement and remains In Transit, with the Move Ongoing. No Strength remains at the origin.                                                                                                                                                                                                                                                                                      |
| Travel                         | Submitting a Move with an All commitment from a Stationed Fleet of 10 Strength to a Planet one Turn away with a friendly Fleet of 20 Strength. All Move Requirements and Conditions hold and no other Effects change these Fleets.                                                                                                                                                             | Merge friendly Fleets at the destination.                                                      | The 10 Strength arrives and merges with the friendly 20 Strength. One Fleet belonging to The Player is Stationed at the destination with 30 Strength. The Transit ends and the Move completes.                                                                                                                                                                                                         |
| Travel                         | Submitting a Move with an All commitment from a Stationed Fleet of 10 Strength to a Planet one Turn away with an Opponent's Fleet of 20 Strength. All Move Requirements and Conditions hold; neither Fleet Assaults and no other Effects change them.                                                                                                                                          | Allow different Players' Fleets to coexist.                                                    | The Player's 10 Strength arrives and remains a separate Fleet from the Opponent's 20 Strength. Both are Stationed at the destination. No combat occurs; the Transit ends and the Move completes.                                                                                                                                                                                                       |
| Travel                         | Submitting Move for 10 Strength from a Stationed Fleet of 30 Strength with a Status that does not prevent movement and remains active this Turn. The destination is 20 LY away at Speed 10. The selection is permitted, all Move Requirements and Conditions hold, and no other Effects change its Strength or Statuses.                                                                       | Keep source Statuses on the source Fleet when only part moves.                                 | At resolution, 10 Strength splits off and travels 10 LY. The moving Fleet remains In Transit with 10 LY left and does not inherit the source Status. The source Fleet remains Stationed with 20 Strength and retains the Status. The Move stays Ongoing.                                                                                                                                               |
| Travel                         | Submitting Move with All from a Stationed Fleet of 30 Strength with a Status that does not prevent movement and remains active this Turn. The destination is 20 LY away at Speed 10. All is permitted, all Move Requirements and Conditions hold, and no other Effects change its Strength or Statuses.                                                                                        | Retain Statuses when the whole Fleet moves with All.                                           | The entire Fleet of 30 Strength departs without splitting and retains its Status. It travels 10 LY and remains In Transit with 10 LY left. No Strength remains at the origin. The Move stays Ongoing.                                                                                                                                                                                                  |
| Travel                         | Submitting Move for exactly 30 Strength from a Stationed Fleet of 30 Strength with a Status that does not prevent movement and remains active this Turn. The destination is 20 LY away at Speed 10. The selection is permitted, all Move Requirements and Conditions hold, and no other Effects change its Strength or Statuses.                                                               | Retain Statuses when a fixed amount moves the whole Fleet.                                     | The entire Fleet of 30 Strength departs without splitting and retains its Status. It travels 10 LY and remains In Transit with 10 LY left. No Strength remains at the origin. The Move stays Ongoing.                                                                                                                                                                                                  |
| Travel, Travel                 | Submitting Move for 30 Strength to one Planet and Move for 40 Strength to another from the same Stationed Fleet of 100 Strength. It still has 100 Strength at resolution. Both selections are permitted, both journeys need more than one Turn, and all other Move Requirements and Conditions hold.                                                                                           | Distribute whole-number commitments from the same source Fleet.                                | Submission does not split the Fleet. At resolution, 30 Strength travels toward the first destination and 40 toward the second. Both remain In Transit with their Moves Ongoing. The remaining 30 Strength stays Stationed at the origin.                                                                                                                                                               |
| Travel, Travel, Travel         | Move commitments of 3, 5, and 7 Strength to separate Planets pass Submission Validation against the same Stationed Fleet of 15 Strength. Before movement, losses reduce it to 6 Strength. Each journey needs more than one Turn; the selections are permitted and all other Move Conditions hold.                                                                                              | Fulfill smaller commitments first after losses reduce available Strength.                      | The Moves resolve in commitment order 3, 5, 7. The Move for 3 receives 3 Strength; the Move for 5 receives the remaining 3. Both travel for one Turn and remain In Transit with their Moves Ongoing. The Move for 7 is Canceled and starts no Transit. No Strength remains at the origin because it was allocated to the first two Moves.                                                              |
| Travel, Travel, Travel         | Three Move commitments of 5 Strength to Planets A, B, and C pass Submission Validation against one Stationed Fleet of 15 Strength. Before movement, losses reduce it to 7 Strength. From the persisted generator state, the pseudorandom tie-break result orders A before B before C. All selections are permitted, each journey needs more than one Turn, and all other Move Conditions hold. | Use reproducible pseudorandom ordering for equal commitments, independent of submission order. | The Move to A receives 5 Strength and the Move to B receives the remaining 2. Both travel for one Turn and remain In Transit with their Moves Ongoing. No Strength remains available for C, so its Move is Canceled and starts no Transit. The same starting game state and Actions produce this result regardless of submission order.                                                                |
| Repeated Assault, Travel       | Submitting Assault for a Stationed Fleet of 30 Strength, then attempting Move for 10 Strength from that Fleet on the same Turn. No other Fleets are on the Planet and no other Effects change its Strength.                                                                                                                                                                                    | Require sufficient uncommitted Strength for the Move commitment.                               | The Move submission is rejected because no Strength is uncommitted, and creates no Move Effect. No Strength splits and no Transit starts. Assault resolves normally with the full 30 Strength; no combat occurs, the Fleet remains Stationed, and the Assault stays Ongoing after consuming one repetition.                                                                                            |
| Fixed Travel, Repeated Assault | Submitting a Move for 10 Strength from a Stationed Fleet of 30, then attempting Assault for that Fleet on the same Turn. The Move needs more than one Turn and all its Requirements and Conditions hold.                                                                                                                                                                                       | Require sufficient uncommitted Strength for Assault's All commitment.                          | The Assault submission is rejected because only 20 of the Fleet's 30 Strength is uncommitted, and creates no Assault Effect. At resolution, the Move sends 10 Strength into Transit and stays Ongoing; 20 Strength remains Stationed at the origin.                                                                                                                                                    |
| Invasion                       | Submitting Move with an All commitment and Assault On Arrival for a Stationed Fleet that an Opponent also targets with a submitted Action containing Pin on the same Turn                                                                                                                                                                                                                      | Cancel On Arrival when its Move is canceled.                                                   | The Opponent's Pin resolves during the Tactics phase after Pay Costs, before Fleet Movement. The Fleet remains Stationed at its origin and no Transit starts. The Move is canceled, which also cancels its pending On Arrival trigger. No Assault is triggered on this or any later Turn by this Action.                                                                                               |
| Invasion                       | Submitting Move with an All commitment and Assault On Arrival for a Fleet Stationed at [Distance] from the destination, with more than one Turn of travel required                                                                                                                                                                                                                             | Keep On Arrival Pending while Move is Ongoing.                                                 | The Move resolves normally and stays Ongoing. On Arrival remains Pending and no Assault is triggered this Turn.                                                                                                                                                                                                                                                                                        |
| Invasion                       | Submitting Move with an All commitment and Assault On Arrival for a Fleet Stationed on the destination Planet                                                                                                                                                                                                                                                                                  | Trigger On Arrival when Move completes without travel.                                         | The Move completes without travel. On Arrival triggers even though the Fleet was already at the destination. Its Assault resolves normally during Fleet Combat.                                                                                                                                                                                                                                        |
| Invasion                       | An ongoing Move with Assault On Arrival that began with an All commitment. Its moving Fleet is In Transit at 1 Turn range of the destination.                                                                                                                                                                                                                                                  | Trigger On Arrival after a Multi-Turn Move completes.                                          | The Move resolves normally and completes at the destination this Turn. On Arrival triggers and its Assault resolves normally during Fleet Combat.                                                                                                                                                                                                                                                      |
| Invasion                       | An ongoing Move with Assault On Arrival began with an All commitment. Its moving Fleet has 10 Strength and 10 LY remaining at Speed 10. The destination has a friendly Fleet of 20 Strength and an Opponent's Fleet of 5 Strength. All Move Conditions hold; no other Effects change these Fleets' Strength or Statuses.                                                                       | Transfer Assault On Arrival to the merged friendly Fleet and use its combined Strength.        | During Fleet Movement, the 10 Strength arrives and merges with the friendly 20 Strength. The Move completes and Assault On Arrival transfers to the merged Fleet. During Fleet Combat, all 30 Strength participates in the triggered Assault. The Fleets exchange damage: the Opponent's Fleet is Destroyed and the friendly Fleet survives with 25 Strength. The single Assault repetition completes. |
| Invasion                       | An ongoing Move with Assault On Arrival began with an All commitment. Its moving Fleet has 10 Strength and 10 LY remaining at Speed 10. The destination has a friendly Fleet of 20 Strength whose Pin remains active through Fleet Combat, and an Opponent's Fleet of 5 Strength. All Move Conditions hold; no other Effects change these Fleets' Strength or Statuses.                        | Preserve the Stationed Fleet's Pin through merging without blocking Assault.                   | During Fleet Movement, the 10 Strength arrives and merges with the friendly 20 Strength. The Move completes. The merged Fleet retains Pin and Assault On Arrival. During Fleet Combat, its triggered Assault uses all 30 Strength despite Pin. The Opponent's Fleet is Destroyed and the friendly Fleet survives with 25 Strength, still Pinned. The single Assault repetition completes.              |
| Fixed Travel                   | Submitting Move from a Stationed Fleet of 30 Strength, with exactly 10 committed and more than one Turn of travel required. All other Move Requirements and Conditions hold.                                                                                                                                                                                                                   | Split only the fixed commitment at resolution.                                                 | Submission leaves the Fleet intact at 30 Strength. At resolution, 10 Strength splits and travels for one Turn. It remains In Transit, the Move stays Ongoing, and 20 Strength remains Stationed at the origin.                                                                                                                                                                                         |
| Fixed Travel                   | Submission Validation succeeds for a commitment of exactly 10 Strength with 10 uncommitted Strength available. Other Effects then reduce the available Strength to 8 before movement resolves in this Turn. More than one Turn of travel is required and all other Move Conditions hold.                                                                                                       | Use remaining available Strength after successful validation.                                  | All 8 remaining Strength begins movement and remains In Transit after this Turn. No Strength remains at the origin. The Move stays Ongoing; the shortage does not cause a failure.                                                                                                                                                                                                                     |
| Fixed Travel                   | Submitting a commitment of exactly 10 Strength from a Stationed Fleet of 8 Strength, all uncommitted. All other Requirements hold and no other Effects change the Fleet this Turn.                                                                                                                                                                                                             | Check Strength availability during Submission Validation.                                      | The submission is rejected and creates no Move Effect. No Strength splits and no movement starts. The Fleet remains Stationed with 8 Strength.                                                                                                                                                                                                                                                         |
| Fixed Travel                   | An ongoing Move's moving Fleet began with 10 Strength and has 8 Strength at the start of this Turn. It has 20 LY remaining at Speed 10, and all Move Conditions hold.                                                                                                                                                                                                                          | Progress with remaining Strength without restoring the original commitment.                    | The 8 Strength travels 10 LY and remains In Transit with 10 LY left. The Move stays Ongoing. No additional Strength splits from the origin.                                                                                                                                                                                                                                                            |
| Fixed Travel                   | Submission Validation succeeds for a commitment of exactly 10 Strength from a Stationed Fleet of 10 Strength. The source Fleet loses all 10 Strength before movement resolves this Turn.                                                                                                                                                                                                       | Cancel a Move whose source Fleet is Destroyed before departure.                                | The source Fleet is Destroyed and the Move is Canceled. No Strength splits, no Transit starts, and no later movement occurs from this Move.                                                                                                                                                                                                                                                            |
| Fixed Travel                   | An ongoing Move began with 10 Strength. Its moving Fleet starts this Turn In Transit with 8 Strength and 20 LY remaining at Speed 10, then reaches 0 Strength before movement resolves.                                                                                                                                                                                                        | Cancel an ongoing Move when its moving Fleet is Destroyed.                                     | The moving Fleet is Destroyed and the Move is Canceled. It makes no movement progress or arrival this Turn and cannot resume on a later Turn.                                                                                                                                                                                                                                                          |
| Full Travel                    | Submitting Move with an All commitment from a Stationed Fleet with 30 Strength at resolution. More than one Turn of travel is required and all Move Requirements and Conditions hold.                                                                                                                                                                                                          | Apply a ruleset-defined All commitment.                                                        | All 30 Strength begins movement and remains In Transit after this Turn. No Strength remains at the origin and the Move stays Ongoing.                                                                                                                                                                                                                                                                  |
| Limited Travel                 | Selecting 15 Strength from a Stationed Fleet of 30, with more than one Turn of travel required. All Move Requirements and Conditions hold.                                                                                                                                                                                                                                                     | Accept a player-selected amount within the Action's 10 to 20 constraint.                       | Submission does not split the Fleet. At resolution, 15 Strength begins movement and remains In Transit; 15 Strength remains Stationed at the origin. The Move stays Ongoing.                                                                                                                                                                                                                           |
| Limited Travel                 | Selecting 5 Strength from a Stationed Fleet of 30.                                                                                                                                                                                                                                                                                                                                             | Enforce the Action's 10 to 20 input constraint.                                                | Submission is rejected. No Move starts and the Fleet remains intact at the origin with 30 Strength.                                                                                                                                                                                                                                                                                                    |

# To Do

- Review the document
- Have 2 independent agents review the document to find inconsistencies, then 1 adjudicate the findings.
- Have 2 independent agents review the document to improve the structure, then 1 adjudicate the findings.
- Make sure we covered all Assault cases
- Make sure we covered all Move cases
- Make sure we covered all Move with Assault on Arrival cases
- Do Colonization
- Do Fleet Production
- (last) add test case unique key. each effect gets a 3? letter key, each test scenario gets the main effect being tested followed by an incrementing number.

# Problems

# Thoughts dump

## Targeting multiple Fleets

Support targeting:

- All Fleets in range.
- All Fleets on a Planet.

Use Pin as an example Effect to demonstrate these targeting options.

## Multiple Effects from one Effect Definition

- Open question: How should one Effect Definition produce multiple Effects?
- Example: The previous Assault definition generated both an Assault Effect and a Pin Effect.

## Charged Actions

- Support delayed Effects such as “Pin 5 in 3 Turns”.
- The Action remains ongoing and cannot be reused during the wind-up Turns.
- Pin applies only on the final Turn.
- Open question: Should this use a Status or Trigger, and how would that keep the Action ongoing during the wind-up?

## Messages as Actions

- Explore sending messages as Actions, delivered at Turn end. This would remain consistent with the principle that player communication must not reward frequent check-ins.
- Delivery could take multiple Turns and could require infrastructure to send or receive.
- Support tight-beam and broadcast messages.
- Movement and Pin requirements may already provide the necessary building blocks:

| Messaging concept                 | Related mechanic                      |
| --------------------------------- | ------------------------------------- |
| Message delivery speed            | Movement speed.                       |
| Broadcast to all Players in range | Pin targeting all Fleets in range.    |
| Message all Players on a Planet   | Pin targeting all Fleets on a Planet. |
