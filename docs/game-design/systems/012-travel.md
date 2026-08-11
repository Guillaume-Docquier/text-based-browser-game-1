# Travel

## Status

Not Implemented

## Purpose

Travel moves Fleets between Planets while making distance and movement speed meaningful strategic constraints.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)
- [System 010-fleets](./010-fleets.md)
- [System 008-planets](./008-planets.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept         | Definition                                                                        |
| --------------- | --------------------------------------------------------------------------------- |
| Speed           | The maximum number of light-years a Fleet travels per Turn.                       |
| Range           | The maximum travel distance allowed between a Fleet and its target Planet.        |
| Travel Distance | The distance in light-years between a Fleet's departure Planet and target Planet. |
| In Transit      | A Fleet that has departed but has not yet arrived.                                |
| Travel Tick     | A sub-step within Turn Resolution that orders travel progress and arrivals.       |

## Rules

A Fleet travels from one Planet to another; it cannot be stationed in empty space. A journey may only target a Planet whose Travel Distance is within its allowed Range.

Travel resolves through the Ticks defined by [System 001-turns](./001-turns.md) during Turn Resolution. Each Turn, an In-Transit Fleet travels up to its Speed toward its target Planet. Fleets arrive in chronological order based on their arrival time. A Fleet that is closer relative to its Speed therefore arrives before a Fleet that reaches the same destination later in the Turn.

Fleets that arrive on the same Travel Tick are simultaneous. A Fleet ceases to be In Transit when it reaches its target Planet.

## Potential Flaws

Long travel times can make Fleets feel unresponsive unless players have useful choices while Fleets are In Transit.
