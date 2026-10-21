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

| Submission validation result | Description                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Valid                        | All targets and inputs satisfy their constraints.                                                                   |
| Undetermined                 | The submission is missing data to determine if it is valid, such as other targets that contraints need to evaluate. |
| Invalid                      | Some targets or inputs do not satisfy some of their constraints.                                                    |
| Already Active               | The Action is Multi-Turn, was submitted in a previous Turn and is still ongoing.                                    |
| Error                        | Something went wrong during validation. This is unexpected.                                                         |

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

| Effect        | Notation                                        | Ruling                                                                                                                                     | Targets                  | Inputs            | Requirements                                                                          | Conditions             | Multi-turn |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ----------------- | ------------------------------------------------------------------------------------- | ---------------------- | ---------- |
| Move          | Move(Fleet, DestinationPlanet, Distance, Speed) | [Fleet] starts or progresses a Transit to [DestinationPlanet] within [Distance] LY at Speed [Speed].                                       | Fleet, DestinationPlanet | Distance, Speed   | Own [Fleet], Stationed, [Fleet] is within [Distance] of [DestinationPlanet], Can Move | Own [Fleet], Can Move  | Yes        |
| Assault       | Assault(Fleet, NbTurns)                         | [Fleet] attacks all other Fleets Stationed on the Planet. Repeats every Turn for [Repeats] Turns.                                          | Fleet                    | Repeats           | Own [Fleet], Stationed                                                                | Own [Fleet], Stationed | Yes        |
| Pin           | Pin(Fleet, NbTurns, Repeats)                    | Pins [Fleet] for [NbTurns] Turns. Repeats every Turn for [Repeats] Turns.                                                                  | Fleet                    | NbTurns, Repeats  | -                                                                                     | -                      | Yes        |
| Colonize      | Colonize(Fleet, Planet)                         | [Fleet] claims [Planet].                                                                                                                   | Fleet, Planet            |                   | Unclaimed [Planet], [Fleet] Stationed on [Planet]                                     | Unclaimed [Planet]     | No         |
| Produce Fleet | Fleet(Strength, Planet)                         | Create a Fleet of [Strength] on [Planet]. If a Fleet is already present, it is reinforced instead. Repeats every Turn for [Repeats] Turns. | Planet                   | Strength, Repeats | -                                                                                     | -                      | Yes        |

Note: When [NbTurns] is 1, the text rules won't mention it.

| Notation                                     | Interpretation                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Fleet(FA)                                    | Reference to Fleet with id FA. Fleet ids are always FL, where L is a letter.                                                                 |
| Planet(PA)                                   | Reference to Planet with id PA. Planet ids are always PL, where L is a letter.                                                               |
| Player(P1)                                   | Reference to Player with id P1. Player ids are always PN, where N is numeric.                                                                |
| fleet(FA, P1, 10, Planet(PB))                | Fleet Entity with id FA, owned by Player P1, with 10 Strength and Stationed on Planet with id PB                                             |
| fleet(FA, P1, 10, Planet(PA)->5->Planet(PB)) | Fleet Entity with id FA, owned by Player P1, with 10 Strength and In Transit from Planet with id PA to Planet with id PB with 5 LY remaining |
| planet(PA, 1, 2)                             | Planet Entity with id PA, at cartesian coordinates (1, 2) in LY                                                                              |
| Assault(FA, X/Y)                             | State Notation: Ongoing Assault Effect on Fleet A, X Turns already Progressed out of Y Repeats.                                              |
| Move(FA, PB, 100, 10)                        | State Notation: Ongoing Move Effect for Fleet FA to Planet PB, within 100 LY at Speed 10.                                                    |
| Pinned(Fleet(FA), 2)                         | State Notation: Fleet FA is Pinned for 2 Turns.                                                                                              |

| Action Ruling                                    | Scenario Description                                                                               | Starting State                                                                                                                        | Submission                                              | Effects Outcome                                                 | Effects Lifecycle                                       | End State | Outcome description |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- | --------- | ------------------- |
| Assault(FA, 5)                                   | Submitting Assault for a Stationed Fleet with no other Fleets on Planet                            | Assault(FA, 0/5), planet(PA, 0, 0), fleet(FA, P1, 10, Planet(PA))                                                                     | Valid                                                   | Assault Progressed                                              | Assault Ongoing                                         |           |                     |
| Assault(FA, 5)                                   | Last Turn of an Assault for a Stationed Fleet with no other Fleets on Planet                       | Assault(FA, 4/5), planet(PA, 0, 0), fleet(FA, P1, 10, Planet(PA))                                                                     | Already Active                                          | Assault Completed                                               | Assault Completed                                       |           |                     |
| Assault(FA, 5)                                   | Submitting Assault for a Fleet In Transit                                                          | Assault(FA, 0/5), planet(PA, 0, 0), planet(PB, 0, 10), fleet(FA, P1, 10, Planet(PB)->5->Planet(PA))                                   | Invalid (Fleet(FA) must be Stationed)                   | Assault Error (Illegal state, Assault Fleet cannot Transit)     | Assault Canceled                                        |           |                     |
| Assault(FA, 5)                                   | 3rd Turn of an Assault for a Stationed Fleet with a stronger opposing Fleet on Planet              | Assault(FA, 2/5), planet(PA, 0, 0), fleet(FA, P1, 10, Planet(PA)), fleet(FB, P2, 20, Planet(PA))                                      | Already Active                                          | Assault Progressed                                              | Assault Canceled                                        |           |                     |
| Assault(FA, 5)                                   | Last Turn of an Assault for a Stationed Fleet with a stronger opposing Fleet on Planet             | Assault(FA, 4/5), planet(PA, 0, 0), fleet(FA, P1, 10, Planet(PA)), fleet(FB, P2, 20, Planet(PA))                                      | Already Active                                          | Assault Completed                                               | Assault Completed                                       |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Fleet Stationed at max Distance from the destination                         | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB))                                            | Valid                                                   | Move Progressed                                                 | Move Ongoing                                            |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Fleet Stationed at 1 Turn range of the destination                           | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 10), fleet(FA, P1, 10, Planet(PB))                                             | Valid                                                   | Move Completed                                                  | Move Completed                                          |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Fleet Stationed on the destination Planet                                    | Move(FA, PA, 100, 10), planet(PA, 0, 0), fleet(FA, P1, 10, Planet(PA))                                                                | Valid                                                   | Move Completed                                                  | Move Completed                                          |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Fleet Stationed too far from the destination                                 | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 101), fleet(FA, P1, 10, Planet(PB))                                            | Invalid (Fleet(FA) must be within 100 LY of Planet(PA)) | Move Error (Illegal state, Move is the only source of movement) | Move Canceled                                           |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Pinned, Stationed Fleet                                                      | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB)), Pinned(Fleet(FA), 1)                      | Invalid (Fleet(FA) must be able to Move)                | Move Prevented                                                  | Move Ongoing                                            |           |                     |
| Move(FA, PA, 100, 10)                            | Ongoing Move for a Pinned Fleet In Transit                                                         | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB)->90->Planet(PA)), Pinned(Fleet(FA), 1)      | Already Active                                          | Move Prevented                                                  | Move Ongoing                                            |           |                     |
| Move(FA, PA, 100, 10)                            | Ongoing Move for a Fleet In Transit with more Distance remaining than the Speed                    | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB)->90->Planet(PA))                            | Already Active                                          | Move Progressed                                                 | Move Ongoing                                            |           |                     |
| Move(FA, PA, 100, 10)                            | Ongoing Move for a Fleet In Transit at 1 Turn range of the destination                             | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB)->10->Planet(PA))                            | Already Active                                          | Move Completed                                                  | Move Completed                                          |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Fleet already In Transit via another Move Effect                             | Move(FA, PA, 100, 5), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB)->90->Planet(PA))                             | Invalid (Fleet(FA) must be Stationed)                   | Move Error (Illegal state)                                      | Move Canceled                                           |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Stationed Fleet that an Opponent Pins on the same Turn                       | Move(FA, PA, 100, 10), Pin(FA, 1, 1) (P2, submitted this Turn), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB))   | Valid (the Pin is not observable)                       | Move Canceled                                                   | Move Canceled, On Arrival Canceled                      |           |                     |
| Move(FA, PA, 100, 10)                            | Submitting Move for a Stationed Fleet that The Player Pins on the same Turn                        | Move(FA, PA, 100, 10), Pin(FA, 1, 1) (P1, submitted this Turn), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB))   | Invalid (Fleet(FA) must be able to Move)                | ??                                                              |                                                         |           |                     |
| Move(FA, PA, 100, 10), OnArrival(Assault(FA, 1)) | Submitting Move with Assault On Arrival for a Fleet Stationed at max Distance from the destination | Move(FA, PA, 100, 10), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB))                                            | Valid                                                   | Move Progressed                                                 | Move Ongoing, On Arrival Pending                        |           |                     |
| Move(FA, PA, 100, 10), OnArrival(Assault(FA, 1)) | Submitting Move with Assault On Arrival for a Fleet Stationed on the destination Planet            | Move(FA, PA, 100, 10), planet(PA, 0, 0), fleet(FA, P1, 10, Planet(PA))                                                                | Valid                                                   | Move Completed                                                  | Move Completed, On Arrival Triggered, Assault Completed |           |                     |
| Move(FA, PA, 100, 10), OnArrival(Assault(FA, 1)) | Ongoing Move with Assault On Arrival for a Fleet In Transit at 1 Turn range of the destination     | Move(FA, PA, 100, 10), OnArrival(Assault(FA, 1)), planet(PA, 0, 0), planet(PB, 0, 100), fleet(FA, P1, 10, Planet(PB)->10->Planet(PA)) | Already Active                                          | Move Completed                                                  | Move Completed, On Arrival Triggered, Assault Completed |           |                     |

Phase ordering:

- Pay Costs
- Statuses? (Pin target Fleet)
- Movements
- Assaults
- Colonization

# Problems

## Pinning a Fleet the same turn it is set to start a Transit

Pinning says a fleet cannot start a transit. This is useful for modeling Assault, which prevents you from starting a Move. This can be done via some turn prediction, where we can apply the effects of your already submitted actions and determine that your Fleet is Pinned and cannot move. Actually, this doesn't work if you commit an Assault to an already moving fleet. The fleet will be Stationed (not yet in Transit), so a valid target. Well, fleet could be In Transit as a projection.

However, if an Opponent Pins your Fleet, you don't know that, and your action is considered valid. When resolution happens, it's harder to do that prediction, because we don't have a clear ordering. If the Move is evaluated first, then it is valid. If the Pin is evaluated first, then the Move is not. In all cases, the Fleet won't move, but the Transit might start.

Idea. Pinning completely Prevents starting a Transit. If an Action that contains a Move and other effects targets a Fleet that gets Pinned, the Move mechanic automatically gets Canceled. The rest of the Effects take place normally. This prevents a Fleet split since the order will target the existing Fleet (not its projection). We solve the "Assault for 5 turns, it cannot move" by having the Assault consume the "movement" point, making it illegal to submit without making the Pin mechanic inconsistent. Or maybe the Fleet can move, and only after Combat it is Pinned?

1 Movement Point to prevent a Fleet from being targeted to move to 2 different places

Ehhhhh doesn't work, because Fleet splitting is a thing that is legal. But also an Assault commits a full Fleet's Strength to the Assault

Can we represent committed Strength?

# Thoughts dump

## Repeated Pin and Action reuse

Support “Pin X every Turn for Y Turns” as a Multi-Turn Action. This allows two choices:

| Action                   | Pin behavior                         | Action reuse                    |
| ------------------------ | ------------------------------------ | ------------------------------- |
| Apply a lasting Pin once | Immediately Pin a Fleet for 5 Turns. | Can be reused every Turn.       |
| Repeat Pin each Turn     | Pin a Fleet every Turn for 5 Turns.  | Cannot be reused while ongoing. |

## Strength commitment solves the Pinning Problem

- Assault commits the Fleet's entire Strength.
- After submitting Assault, no Move can be submitted for that Fleet because no uncommitted Strength remains.
- Assault cannot be submitted if any of the Fleet's Strength is already committed to movement.
- Remove Assault's Pin component: Strength commitment prevents conflicting submissions.

## Effects to add

- Build.

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
