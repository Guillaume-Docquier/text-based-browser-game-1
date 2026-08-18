# Movement

## Status

Not Implemented

## Purpose

Movement moves Fleets between Planets while making distance and movement speed meaningful strategic constraints.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)
- [System 010-fleets](./010-fleets.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept           | Definition                                                                        |
| ----------------- | --------------------------------------------------------------------------------- |
| Speed             | The maximum number of light-years a Fleet moves per Turn.                         |
| Range             | The maximum Movement Distance allowed between a Fleet and its target Planet.      |
| Movement Distance | The distance in light-years between a Fleet's departure Planet and target Planet. |
| In Transit        | A Fleet that has departed but has not yet arrived.                                |
| Movement Tick     | A sub-step within the Movement Phase that orders movement progress and arrivals.  |

## Rules

A Fleet moves from one Planet to another; it cannot be stationed in empty space. A movement may only target a Planet whose Movement Distance is within its allowed Range.

Movement resolves through the Ticks defined by [System 001-turns](./001-turns.md) during Turn Resolution. Each Turn, an In-Transit Fleet moves up to its Speed toward its target Planet. Fleets arrive in chronological order based on their arrival time. A Fleet that is closer relative to its Speed therefore arrives before a Fleet that reaches the same destination later in the Turn.

Fleets that arrive on the same Movement Tick are simultaneous. A Fleet ceases to be In Transit when it reaches its target Planet.

## Potential Flaws

Long travel times can make Fleets feel unresponsive unless players have useful choices while Fleets are In Transit.
