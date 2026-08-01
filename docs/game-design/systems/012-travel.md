# Travel

## Purpose

Travel moves Fleets between Planets while making distance and movement speed meaningful strategic constraints.

Relates to:

- [System 003-actions](./003-actions.md)
- [System 010-fleets](./010-fleets.md)

## Core Concepts

| Concept    | Definition                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| Speed      | The maximum number of light-years a Fleet travels per turn.                |
| Range      | The maximum travel distance allowed between a Fleet and its target Planet. |
| In transit | A Fleet that has departed but has not yet arrived.                         |

## Rules

Travel at Speed X, Range Y may target a Planet whose travel distance from the Fleet is at most Y light-years. Each turn, the Fleet travels up to X light-years toward that target until it arrives.

A Fleet is in transit from departure until immediately before arrival. It arrives when it reaches its target Planet and is no longer in transit before arrival effects resolve.

## Potential Flaws

Long travel times can make Fleet actions feel unresponsive unless players have useful choices while Fleets are in transit.
