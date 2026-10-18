| Term              | Definition                                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action Definition | A player authored composition of Effects, with Requirements and Conditions.                                                                                                                                             |
| Effect Definition | An engine owned game mechanic, with Requirements and Conditions.                                                                                                                                                        |
| Action            | An instance of an Action Definition.                                                                                                                                                                                    |
| Multi-Turn Action | A Multi-Turn Action is submitted once, paying costs once, and cannot be resubmitted until all Multi-Turn Effects are Ended. A Multi-Turn Action can be canceled by The Player. Cancellation may have Costs and Effects. |
| Effect            | An instance of an Effect Definition.                                                                                                                                                                                    |
| Multi-Turn Effect | A Multi-Turn Effect happens over multiple turns. Certain events can Cancel an Effect, like a fleet being destroyed, but The Player cannot Cancel a single Effect directly.                                              |
| Requirement       | Something that must be true when the Action is submitted. Applies to Effects.                                                                                                                                           |
| Condition         | Something that must be true when the Effect resolves.                                                                                                                                                                   |
| Status            | A persistent Buff/Debuff/State that applies to an Entity.                                                                                                                                                               |
| Entity            | Something that can be affected by an Action. Planet, Fleet and Player.                                                                                                                                                  |
| Turn              | A full Action Submission + Effect Resolution game loop. Turns have a fixed duration decided before the start of the game.                                                                                               |
| The Player        | The current Player.                                                                                                                                                                                                     |
| Opponent          | Any other Player in the game.                                                                                                                                                                                           |

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
| Error          | Something went wrong during resolution. This is unexpected.                          |

| Status     | Description                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger    | A Trigger is a category of Buffs that causes an Effect to Resolve when a condition is met. The same Trigger can be triggered multiple times. A Trigger can be canceled by another Effect. |
| Stationed  | A Fleet is Stationed when it is on a planet.                                                                                                                                              |
| In Transit | A Fleet is In Transit when it has departed from an origin Planet and has not yet arrived to its destination Planet                                                                        |
| Moving     | A Fleet is Moving when its Transit is progressing.                                                                                                                                        |
| Pinned     | A Pinned Fleet cannot start or progress a Transit. An existing Transit is paused, but remains active.                                                                                     |
| Destroyed  | A Fleet that reaches 0 Strength.                                                                                                                                                          |

| Trigger    | Description                                        |
| ---------- | -------------------------------------------------- |
| On Arrival | Causes an Effect when a Fleet arrives at a Planet. |

| Effect   | Ruling                                                                                                               | Targets                  | Inputs          | Requirements                                                       | Conditions | Multi-turn |
| -------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------- | ------------------------------------------------------------------ | ---------- | ---------- |
| Move     | Target <Fleet> starts or progresses a Transit to <DestinationPlanet> within <Distance> at Speed <Speed>.             | Fleet, DestinationPlanet | Distance, Speed | Stationed, Fleet is within Distance of DestinationPlanet, Can Move | Can Move   | Yes        |
| Assault  | Target <Fleet> attacks all other Fleets Stationed on the Planet. Pin <Fleet>. Repeats every Turn for <NbTurns> Turns | Fleet                    | NbTurns         | Stationed                                                          | Stationed  | Yes        |
| Pin      | Pins target <Fleet> for <NbTurns> Turns.                                                                             | Fleet                    | NbTurns         | -                                                                  | -          | No         |
| Colonize |                                                                                                                      |                          |                 |                                                                    |            | No         |

| Action Ruling                                     | Scenario                                                   | Submission                                        | Resolution                                                 | Lifecycle         |
| ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | ----------------- |
| fleetA Assaults every Turn for 5 Turns.           | fleetA is stationed, turn 1/5                              | Valid                                             | Progressed                                                 | Assault Ongoing   |
| fleetA Assaults every Turn for 5 Turns.           | fleetA is stationed, turn 5/5                              | -                                                 | Completed                                                  | Assault Completed |
| fleetA Assaults every Turn for 5 Turns.           | fleetA is In Transit                                       | Invalid (fleetA must be Stationed)                | Error (Illegal state, Assault Pins)                        | Assault Canceled  |
| fleetA Assaults every Turn for 5 Turns.           | fleetA is Destroyed, turn 2/5                              | -                                                 | -                                                          | Assault Canceled  |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 100 LY away from planetB               | Valid                                             | Progressed                                                 | Move Ongoing      |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 10 LY away from planetB                | Valid                                             | Completed                                                  | Move Completed    |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 0 LY away from planetB                 | Valid                                             | Completed                                                  | Move Completed    |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 101 LY away from planetB               | Invalid (fleetA must be within 100 LY of planetB) | Error (Illegal state, Move is the only source of movement) | Move Canceled     |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is Pinned                                           | Invalid (fleetA must be able to Move)             | Prevented                                                  | Move Ongoing      |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is In Transit via this Effect but is now Pinned     | Already Active                                    | Prevented                                                  | Move Ongoing      |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is In Transit via this Effect                       | Already Active                                    | Progressed                                                 | Move Ongoing      |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is In Transit via this Effect and arrives this turn | Already Active                                    | Completed                                                  | Move Completed    |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is In Transit via another Effect                    | Invalid (fleetA must be Stationed)                | Error (Illegal state)                                      | Move Canceled     |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA gets Pinned by an Opponent on the same turn         | Valid (the Pin is not observable)                 | ??                                                         |                   |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA gets Pinned by The Player on the same turn          | Invalid (fleetA must be able to Move)             | ??                                                         |                   |

Phase ordering:

- Pay Costs
- Statuses? (Pin target Fleet)
- Movements
- Assaults
- Colonization
