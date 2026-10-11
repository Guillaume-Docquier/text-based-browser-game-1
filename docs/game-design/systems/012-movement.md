# Movement

## Status

Partially Implemented

The Standard and independent Test Rulesets offer three Move Fleet Directives with speeds of 0.1, 1, and 5 light-years per Turn and maximum departure distances of 5, 5, and 25 light-years. A submission selects an owned stationary Fleet, a positive whole-number Strength allocation and a distinct destination Planet in range. The selected Strength departs as a deterministic child Fleet; any remainder keeps the original Fleet's ID and name.

Journeys automatically advance once per Turn using their persisted departure speed. Remaining distance is derived from the route length and elapsed Turns, avoiding accumulated subtraction error that could delay arrival by an extra Turn; distinct tiny remaining distances are preserved. Costs are paid only on departure. The initiating Action instance remains occupied until arrival or terminal removal; it cannot be edited, redirected, cancelled or reused in transit. Other instances remain independently usable. On arrival, the child lands or merges into a positive same-owner stationed Fleet, preserving that stationed Fleet's identity. Ordinary Move causes no combat or ownership change.

The Fleet Movement Phase materializes all departures before advancing journeys, in canonical player/Action order. Zero-distance travel to a distinct coincident Planet arrives immediately. It calculates an arrival Tick but does not yet coordinate chronological movement and arrivals through the 20-Tick loop. Arrival provenance and composed arrival effects remain planned.

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
| Range             | The maximum Movement Distance allowed between a Fleet and its target Planet.           |
| Movement Distance | The distance in light-years between a Fleet's departure Planet and target Planet.      |
| In Transit        | A Fleet that has departed but has not yet arrived.                                     |
| Movement Tick     | A sub-step within the Fleet Movement Phase that orders movement progress and arrivals. |

## Rules

A Fleet moves from one Planet to another; it cannot be stationed in empty space. A movement may only target a Planet whose Movement Distance is within its allowed Range.

Movement resolves through the Ticks defined by [System 001-turns](./001-turns.md) during Turn Resolution. Each Turn, an In-Transit Fleet moves up to its Speed toward its target Planet. Fleets arrive in chronological order based on their arrival time. A Fleet that is closer relative to its Speed therefore arrives before a Fleet that reaches the same destination later in the Turn.

Fleets that arrive on the same Movement Tick are simultaneous. A Fleet ceases to be In Transit when it reaches its target Planet.

## Potential Flaws

Long travel times can make Fleets feel unresponsive unless players have useful choices while Fleets are In Transit.
