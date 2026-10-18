| Term              | Definition                                                                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action Definition | A player authored composition of Effects, with Requirements and Conditions.                                                                                                                                                 |
| Effect Definition | An engine owned game mechanic, with Requirements and Conditions.                                                                                                                                                            |
| Action            | An instance of an Action Definition.                                                                                                                                                                                        |
| Multi-Turn Action | A Multi-Turn Action is submitted once, paying costs once, and cannot be resubmitted until all Multi-Turn Effects are Completed. A Multi-Turn Action can be canceled by The Player. Cancellation may have Costs and Effects. |
| Effect            | An instance of an Effect Definition.                                                                                                                                                                                        |
| Requirement       | Something that must be true when the Action is submitted. Applies to Effects.                                                                                                                                               |
| Condition         | Something that must be true when the Effect resolves.                                                                                                                                                                       |
| Status            | A persistent Buff/Debuff/State that applies to an Entity.                                                                                                                                                                   |
| Entity            | Something that can be affected by an Action. Planet, Fleet and Player.                                                                                                                                                      |
| Turn              | A full Action Submission + Effect Resolution game loop. Turns have a fixed duration decided before the start of the game.                                                                                                   |
| The Player        | The current Player.                                                                                                                                                                                                         |
| Opponent          | Any other Player in the game.                                                                                                                                                                                               |

| Submission validation result | Description                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Valid                        | All targets and inputs satisfy their constraints.                                                                   |
| Undetermined                 | The submission is missing data to determine if it is valid, such as other targets that contraints need to evaluate. |
| Invalid                      | Some targets or inputs do not satisfy some of their constraints.                                                    |
| Error                        | Something went wrong during validation. This is unexpected.                                                         |

| Effect resolution result | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Progressed               | The Effect resolved and applied its Effects partially. Applies to multi-turn Effects |
| Completed                | The Effect resolved and applied its full Effects.                                    |
| Prevented                | The Effect could not resolve because some conditions we're not met.                  |
| Error                    | Something went wrong during resolution. This is unexpected.                          |

| Status     | Description                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger    | A Trigger is a category of Buffs that causes an Effect to Resolve when a condition is met. The same Trigger can be triggered multiple times. A Trigger can be canceled by another Effect. |
| Stationed  | A Fleet is Stationed when it is on a planet.                                                                                                                                              |
| In Transit | A Fleet is In Transit when it has departed from an origin Planet and has not yet arrived to its destination Planet                                                                        |
| Moving     | A Fleet is Moving when its Transit is progressing.                                                                                                                                        |
| Pinned     | A Pinned Fleet cannot start or progress a Transit. An existing Transit is paused, but remains active.                                                                                     |

| Trigger    | Description                                        |
| ---------- | -------------------------------------------------- |
| On Arrival | Causes an Effect when a Fleet arrives at a Planet. |

| Effect  | Ruling                                                                                                               | Targets                  | Inputs          | Requirements                                                       | Conditions | Multi-turn |
| ------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------- | ------------------------------------------------------------------ | ---------- | ---------- |
| Move    | Target <Fleet> starts or progresses a Transit to <DestinationPlanet> within <Distance> at Speed <Speed>.             | Fleet, DestinationPlanet | Distance, Speed | Stationed, Fleet is within Distance of DestinationPlanet, Can Move | Can Move   | Yes        |
| Assault | Target <Fleet> attacks all other Fleets Stationed on the Planet. Pin <Fleet>. Repeats every Turn for <NbTurns> Turns | Fleet                    | NbTurns         | Stationed                                                          | Stationed  | Yes        |
| Pin     | Pins target <Fleet> for <NbTurns> Turns.                                                                             | Fleet                    | NbTurns         | -                                                                  | -          | No         |

| Action Ruling                                     | Scenario                                               | Submission                                        | Resolution            |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | --------------------- |
| fleetA Assaults every Turn for 5 Turns.           | fleetA is stationed                                    | Valid                                             | Completed             |
| fleetA Assaults every Turn for 5 Turns.           | fleetA is In Transit                                   | Invalid (fleetA must be Stationed)                | Error (Illegal state) |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 100 LY away from planetB           | Valid                                             | Progressed            |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 10 LY away from planetB            | Valid                                             | Completed             |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 0 LY away from planetB             | Valid                                             | Completed             |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is stationed 101 LY away from planetB           | Invalid (fleetA must be within 100 LY of planetB) | Error (Illegal state) |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is Pinned                                       | Invalid (fleetA must be able to Move)             | Prevented             |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is In Transit via this Effect but is now Pinned | Invalid (fleetA must be able to Move)             | Prevented             |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is In Transit via this Effect                   | Valid                                             | Progressed/Completed  |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA is In Transit via another Effect                | Invalid (fleetA must be Stationed)                | Error (Illegal state) |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA gets Pinned by an Opponent on the same turn     | Valid (the Pin is not observable)                 | ??                    |
| Move fleetA to planetB within 100 LY at Speed 10. | fleetA gets Pinned by The Player on the same turn      | Invalid (fleetA must be able to Move)             | ??                    |

Phase ordering:

- Pay Costs
- Statuses? (Pin target Fleet)
- Movements
- Assaults
- Colonization
