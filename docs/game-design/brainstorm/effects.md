# Purpose and editing workflow

This document builds a list of game requirements that can later become test cases. These requirements are currently called scenarios. Scenarios guide clarification of the rest of the document: define terms and describe supporting mechanics as needed to make each scenario understandable and unambiguous.

Each scenario describes the game state before and after one Turn, with the reason for covering that behavior:

- **Action(s)** identifies the Action being tested so readers can determine which Effects are involved.
- **Scenario** describes the preconditions or starting game state.
- **Intent** states the rule or behavior the scenario aims to cover. It is information about the scenario's purpose.
- **Outcome** describes what happens and the expected resulting game state.

Each scenario covers exactly one Turn. Cover behavior across multiple Turns with separate scenarios. The starting state can include an Action or Effect already in progress. For example, one scenario covers submitting Assault for a Stationed Fleet; another starts on the final Turn of an already ongoing Assault. A row does not need to describe the prior Turns.

Editing is collaborative. Understand the human's intended meaning and identify gaps and ambiguities. Discuss unresolved game-design choices before making changes that depend on them; do not infer missing decisions from existing prose. Record clarified intent here so later agents have the context.

# Glossary

| Term              | Definition                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action Definition | A player authored composition of Effects, with Requirements and Conditions.                                                                                                                                             |
| Effect Definition | An engine owned game mechanic, with Requirements and Conditions.                                                                                                                                                        |
| Action            | An instance of an Action Definition.                                                                                                                                                                                    |
| Multi-Turn Action | A Multi-Turn Action is submitted once, paying costs once, and cannot be resubmitted until all Multi-Turn Effects are Ended. A Multi-Turn Action can be canceled by The Player. Cancellation may have Costs and Effects. |
| Effect            | An instance of an Effect Definition.                                                                                                                                                                                    |
| Multi-Turn Effect | A Multi-Turn Effect happens over multiple turns. Certain events can Cancel an Effect, like a fleet being destroyed, but The Player cannot Cancel a single Effect directly.                                              |
| Requirement       | Something that must be true when the Action is submitted. Effects often have their own Requirements.                                                                                                                    |
| Condition         | Something that must be true when the Effect resolves.                                                                                                                                                                   |
| Status            | A persistent Buff/Debuff/State that applies to an Entity.                                                                                                                                                               |
| Entity            | Something that can be affected by an Action. Planet, Fleet and Player.                                                                                                                                                  |
| Turn              | A full Action Submission + Effect Resolution game loop. Turns have a fixed duration decided before the start of the game.                                                                                               |
| The Player        | The current Player.                                                                                                                                                                                                     |
| Opponent          | Any other Player in the game.                                                                                                                                                                                           |
| Distance          | A Distance, in Light Years (LY).                                                                                                                                                                                        |
| Speed             | A Distance per Turn.                                                                                                                                                                                                    |

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
| Destroyed  | A Fleet that reaches 0 Strength.                                                                                                                                                          |

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

| Effect        | Notation                                        | Ruling                                                                                                                                     | Targets                  | Inputs            | Requirements                                                                          | Conditions                                                                 | Multi-turn |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ----------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------- |
| Move          | Move(Fleet, DestinationPlanet, Distance, Speed) | [Fleet] starts or progresses a Transit to [DestinationPlanet] within [Distance] LY at Speed [Speed].                                       | Fleet, DestinationPlanet | Distance, Speed   | Own [Fleet], Stationed, [Fleet] is within [Distance] of [DestinationPlanet], Can Move | Own [Fleet], [Fleet] is within [Distance] of [DestinationPlanet], Can Move | Yes        |
| Assault       | Assault(Fleet, NbTurns)                         | [Fleet] attacks all other Fleets Stationed on the Planet. Repeats every Turn for [Repeats] Turns.                                          | Fleet                    | Repeats           | Own [Fleet], Stationed                                                                | Own [Fleet], Stationed                                                     | Yes        |
| Pin           | Pin(Fleet, NbTurns, Repeats)                    | Pins [Fleet] for [NbTurns] Turns. Repeats every Turn for [Repeats] Turns.                                                                  | Fleet                    | NbTurns, Repeats  | -                                                                                     | -                                                                          | Yes        |
| Colonize      | Colonize(Fleet, Planet)                         | [Fleet] claims [Planet].                                                                                                                   | Fleet, Planet            | -                 | Unclaimed [Planet], [Fleet] Stationed on [Planet]                                     | Unclaimed [Planet], [Fleet] Stationed on [Planet]                          | No         |
| Produce Fleet | Fleet(Strength, Planet)                         | Create a Fleet of [Strength] on [Planet]. If a Fleet is already present, it is reinforced instead. Repeats every Turn for [Repeats] Turns. | Planet                   | Strength, Repeats | -                                                                                     | -                                                                          | Yes        |

Note: When [NbTurns] is 1, the text rules won't mention it.

# Phases

Phases resolve in deterministic order.

| Name                     | Description                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Pay Costs                | Validate and apply the costs committed by locked Action Submissions.                    |
| Statuses / Utility — TBD | Undecided: name, scope, and placement. May resolve Effects such as Pin before Movement. |
| Fleet Movement           | Resolve Fleet movements and triggers arrivals.                                          |
| Fleet Production         | Resolve Fleet production on Planets.                                                    |
| Fleet Combat             | Resolve all combats.                                                                    |
| Colonization             | Resolve attempts to claim Unclaimed Planets.                                            |

# Sample Actions

| Name             | Description                                                                          | Effects                                        | Requirements | Conditions |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- | ------------ | ---------- |
| Repeated Assault | Your [Fleet] Assaults for 5 Turns.                                                   | Assault(F, 5)                                  | -            | -          |
| Travel           | Your [Fleet] Moves to target [Planet] within 100 LY at Speed 10.                     | Move(F, P, 100, 10)                            | -            | -          |
| Invasion         | Your [Fleet] Moves to target [Planet] within 100 LY at Speed 10. Assault On Arrival. | Move(F, P, 100, 10), OnArrival(Assault(FA, 1)) | -            | -          |

# Scenarios

| Action(s)        | Scenario                                                                                                                                     | Intent                                                                   | Outcome                                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repeated Assault | Submitting Assault for a Stationed Fleet with no other Fleets on Planet                                                                      | Start a Multi-Turn Effect.                                               | No combat occurs and Fleet Strength does not change. The Fleet remains Stationed. One Assault repetition is consumed; [Repeats] minus one repetitions remain and the Assault stays Ongoing.                                                                                                                                     |
| Repeated Assault | Last Turn of an Assault for a Stationed Fleet with no other Fleets on Planet                                                                 | Complete a Multi-Turn Effect.                                            | No combat occurs and Fleet Strength does not change. The Fleet remains Stationed. The final Assault repetition is consumed and the Assault completes.                                                                                                                                                                           |
| Repeated Assault | Submitting Assault for a Fleet In Transit                                                                                                    | Enforce the Stationed Requirement.                                       | Submission is rejected because the Fleet is In Transit. This Action causes no combat and does not change the existing Transit.                                                                                                                                                                                                  |
| Repeated Assault | An intermediate Turn of an Assault for a Stationed Fleet with a stronger opposing Fleet on Planet                                            | Cancel an Ongoing Effect after its Fleet is Destroyed.                   | The Fleets exchange damage. The attacking Fleet is Destroyed; the opposing Fleet survives with its Strength reduced by the attacker's Strength before combat. The current Assault repetition resolves with outcome Progressed, then the Assault is Canceled because the attacker was Destroyed. No remaining repetitions occur. |
| Repeated Assault | Last Turn of an Assault for a Stationed Fleet with a stronger opposing Fleet on Planet                                                       | Complete the final repetition despite Fleet destruction.                 | The Fleets exchange damage. The attacking Fleet is Destroyed; the opposing Fleet survives with its Strength reduced by the attacker's Strength before combat. The final Assault repetition resolves and the Assault completes because no repetitions remain.                                                                    |
| Travel           | Submitting Move for a Fleet Stationed at [Distance] from the destination, with more than one Turn of travel required                         | Accept the Distance limit and start a Multi-Turn Move.                   | The Fleet departs and travels at [Speed] toward the destination for one Turn. It remains In Transit with [Distance] minus the distance covered this Turn remaining. The Move stays Ongoing.                                                                                                                                     |
| Travel           | Submitting Move for a Fleet Stationed at 1 Turn range of the destination                                                                     | Complete a Multi-Turn Effect on its first resolution.                    | The Fleet covers the remaining distance at [Speed] and becomes Stationed on the destination Planet this Turn. The Transit ends and the Move completes.                                                                                                                                                                          |
| Travel           | Submitting Move for a Fleet Stationed on the destination Planet                                                                              | Complete Move without travel.                                            | The Fleet remains Stationed on the destination Planet. No distance is traveled and no Transit is needed. The Move completes.                                                                                                                                                                                                    |
| Travel           | Submitting Move for a Fleet Stationed too far from the destination                                                                           | Enforce the Distance Requirement.                                        | Submission is rejected because the destination is beyond the Move's [Distance] limit. The Fleet remains Stationed at its origin and no Transit starts.                                                                                                                                                                          |
| Travel           | Submitting Move for a Pinned, Stationed Fleet                                                                                                | Pin blocks the Can Move Requirement.                                     | Submission is rejected because the Fleet is already Pinned. The Fleet remains Stationed and no Transit starts.                                                                                                                                                                                                                  |
| Travel           | Ongoing Move for a Pinned Fleet In Transit                                                                                                   | Pin fails the Can Move Condition and pauses an Ongoing Move.             | The Fleet makes no movement progress. It remains In Transit toward the same destination with the same remaining distance. The Move stays Ongoing and can resume on a later Turn when the Fleet is no longer Pinned.                                                                                                             |
| Travel           | Ongoing Move for a Fleet In Transit with more Distance remaining than the Speed                                                              | Progress a Multi-Turn Effect on a later Turn.                            | The Fleet travels at [Speed] toward the destination for one Turn. Its remaining distance decreases by the distance covered this Turn. It remains In Transit and the Move stays Ongoing.                                                                                                                                         |
| Travel           | Ongoing Move for a Fleet In Transit at 1 Turn range of the destination                                                                       | Complete a Multi-Turn Move on a later Turn.                              | The Fleet covers the remaining distance at [Speed] and becomes Stationed on the destination Planet this Turn. The Transit ends and the Move completes.                                                                                                                                                                          |
| Travel           | Submitting Move for a Fleet already In Transit via another Move Effect                                                                       | An existing Transit blocks a new Move through the Stationed Requirement. | The new submission is rejected because another Move already controls the Fleet's Transit. It does not replace or cancel the existing Move, which resolves normally.                                                                                                                                                             |
| Travel           | Submitting Move for a Stationed Fleet that an Opponent Pins on the same Turn                                                                 | An unseen Pin cancels departure during resolution.                       | The Opponent's Pin resolves normally before Movement. The Fleet remains Stationed at its origin, no Transit starts, and the new Move is canceled.                                                                                                                                                                               |
| Travel           | Submitting Move for a Stationed Fleet that The Player Pins on the same Turn                                                                  | A known Pin conflict warns without rejecting submission.                 | The Player sees a warning about the conflicting Pin. If both Actions remain submitted, Pin resolves normally before Movement: the Fleet remains Stationed at its origin, no Transit starts, and the new Move is canceled.                                                                                                       |
| Invasion         | Submitting Move with Assault On Arrival for a Stationed Fleet that an Opponent Pins on the same Turn                                         | Cancel On Arrival when its Move is canceled.                             | The Opponent's Pin resolves normally before Movement. The Fleet remains Stationed at its origin and no Transit starts. The Move is canceled, which also cancels its pending On Arrival trigger. No Assault is triggered on this or any later Turn by this Action.                                                               |
| Invasion         | Submitting Move with Assault On Arrival for a Fleet Stationed at [Distance] from the destination, with more than one Turn of travel required | Keep On Arrival Pending while Move is Ongoing.                           | The Move resolves normally and stays Ongoing. On Arrival remains Pending and no Assault is triggered this Turn.                                                                                                                                                                                                                 |
| Invasion         | Submitting Move with Assault On Arrival for a Fleet Stationed on the destination Planet                                                      | Trigger On Arrival when Move completes without travel.                   | The Move completes without travel. On Arrival triggers even though the Fleet was already at the destination. Its Assault resolves normally during the Assault Phase.                                                                                                                                                            |
| Invasion         | Ongoing Move with Assault On Arrival for a Fleet In Transit at 1 Turn range of the destination                                               | Trigger On Arrival after a Multi-Turn Move completes.                    | The Move resolves normally and completes at the destination this Turn. On Arrival triggers and its Assault resolves normally during the Assault Phase.                                                                                                                                                                          |

# To Do

- Add Assault & Move Strength commitments
- Make sure we covered all Assault cases
- Make sure we covered all Move cases
- Make sure we covered all Move with Assault on Arrival cases
- Do Colonization
- Do Fleet Production

# Problems

## Pinning a Fleet the same turn it is set to start a Transit

Solution: Commit Strength

# Thoughts dump

## Strength commitment solves the Pinning Problem

- Assault commits the Fleet's entire Strength.
- After submitting Assault, no Move can be submitted for that Fleet because no uncommitted Strength remains.
- Assault cannot be submitted if any of the Fleet's Strength is already committed to movement.
- Remove Assault's Pin component: Strength commitment prevents conflicting submissions.

## Targeting multiple Fleets

Support targeting:

- All Fleets in range.
- All Fleets on a Planet.

Use Pin as an example Effect to demonstrate these targeting options.

## Multiple Effects from one Effect Definition

- Open question: How should one Effect Definition produce multiple Effects?
- Example: The previous Assault definition generated both an Assault Effect and a Pin Effect.

## Clearer examples and test mapping

- Define example Actions before the Action examples table, then refer to them by name to shorten the table.
- Consider explicit start-state and end-state columns in the Action examples table.
- Add identifiers in the first column of each table:

| Table           | Identifier                                                |
| --------------- | --------------------------------------------------------- |
| Effects Rulings | A three-letter Effect key.                                |
| Action examples | The Effect key followed by a three-digit scenario number. |

Use the Action examples table as a requirements table and map each scenario to a test through its identifier.

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
