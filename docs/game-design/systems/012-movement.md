# Movement

## Status

Partially Implemented

The Standard and Test Rulesets offer Move Fleet Directives with speeds of 0.1, 1, and 5 light-years per Turn and inclusive ranges of 5, 10, and 25 light-years. A submission selects an owned, stationary Fleet, a positive whole-number Strength allocation, and a different destination Planet within the Action's range. The shared eligibility evaluator applies these constraints and aggregates resource and Strength commitments across all of the player's submissions.

A departure moves only its selected Strength. The source keeps any unallocated remainder, and the new moving Fleet persists its speed, departure Turn, and originating Action Submission. It advances once during its departure Turn and automatically once on every later resolved Turn; the costs are paid only for the new submission. The originating Action Instance remains In Progress until the Fleet arrives. A different Action Instance may use the source's remaining stationary Strength.

The Fleet Movement Phase calculates arrival Ticks on a 20-Tick scale and settles arrivals by Tick, then stable Fleet ID. A Fleet lands at an empty Planet or merges into the same player's stationed Fleet, preserving the latter's ID and name. A compatible Move+Assault submission captures its normal Assault definition in the Fleet's movement JSON; that pending intent is not created as a current-turn Effect during departure. On arrival it retains the initiating order's Tick and provenance through friendly merging, then resolves in Fleet Combat after every arrival and Fleet Build. Continuation outcomes are returned transiently with the current resolved Turn and are not stored as resolved-action history. Colonization remains planned.

The galaxy map shows an In-Transit Fleet between its origin and destination stars according to its remaining distance. A solid route segment shows distance traveled, and a dashed segment shows distance remaining. The Fleet icon points toward its destination and displays its Strength. A movement between Planets in the same Star System appears at that star without a visible interstellar route.

The Star System map has a boundary ring two orbital slots beyond its outermost Planet. It places an In-Transit Fleet at its position along the route while the Fleet is inside that system, or at the route's boundary crossing while the Fleet is outside. The icon faces the direction of travel. Solid and dashed route segments connect the relevant Planet and Fleet, and end at the boundary. A Fleet moving between Planets in one Star System remains on its route within that system.

## Purpose

Movement moves Fleets between Planets while making distance and movement speed meaningful strategic constraints.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)
- [System 010-fleets](./010-fleets.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept           | Definition                                                                             |
| ----------------- | -------------------------------------------------------------------------------------- |
| Speed             | The maximum number of light-years a Fleet moves per Turn.                              |
| Range             | The inclusive maximum Movement Distance allowed between a Fleet and its target Planet. |
| Movement Distance | The distance in light-years between a Fleet's departure Planet and target Planet.      |
| In Transit        | A Fleet that has departed but has not yet arrived.                                     |
| Movement Tick     | A point on the 20-Tick scale used to order Fleet arrivals and their pending Assaults.  |

## Rules

A Fleet moves between Planets; it cannot be stationed in empty space. A movement may only target a different Planet whose planar Movement Distance is within the Action's inclusive Range. The source must be owned by the submitting player, stationary, and have enough unallocated Strength for the positive amount selected.

During Turn Resolution, each new departure and each existing In-Transit Fleet advances by up to its persisted Speed once. The Movement Phase calculates the arrival Tick using the 20-Tick scale, then settles every arrival before Fleet Build. Ordinary landing and friendly merging use Tick order with Fleet ID as a stable tie-breaker. Arrival removes the movement fields and releases the bound Action Instance. A friendly stationary Fleet at the destination receives the arriving Strength; enemy Fleets remain separate for the later Combat Phase. A movement origin does not count as a stationed Fleet while its journey is in transit.

A Move+Assault arrival creates a transient intent for its initiating Action and captured Assault definition. Friendly merging changes the actual Fleet that carries the intent, but does not replace its initiating Tick or order. Fleet Combat applies these intents only after all arrivals and Fleet Builds have settled; no pending intent remains in the next Turn.

## Potential Flaws

Long travel times can make Fleets feel unresponsive unless players have useful choices while Fleets are In Transit.
