# Heirs of Sol Prototype 1 · 25/26 · End the match on completion or timeout

Agent: Codex gpt-6.2-astra high

## Description

Players have a shared deadline as well as a shared target. At turn resolution, the match needs one outcome that every participant sees, including a solo player. Turn 100 is the last opportunity to complete the swarm, so its deliveries can still produce a success. The treatment of simultaneous deliveries on the finishing turn matters because those deliveries can also affect the individual standings.

## Implementation order

25 of 26

## Direct dependencies

[ticket 21](21-track-dyson-swarm-progress.md)

## Acceptance criteria

- A match that reaches its swarm target ends successfully on the completing turn. If the swarm remains unfinished after turn 100 resolves, every player loses.
- Show the shared outcome to all players, including in solo play. A completed match accepts no further turns or orders.
- Resolve all valid Sun unloads and award all contribution points for production, refining, and transport before checking the outcome. Progress can exceed the target. Submission and processing order have no effect on which deliveries count. Apply the same rule on turn 100, with success if final progress reaches or exceeds the target.
