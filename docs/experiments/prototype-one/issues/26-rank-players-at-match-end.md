# Heirs of Sol Prototype 1 · 26/26 · Rank players at match end

Agent: Codex gpt-6.2-astra high

## Description

Completing the swarm answers whether the players succeeded together. Final standings answer which players contributed most across production, transport, and refining. Use the public scores after the finishing turn so players can connect the result to the deliveries they saw. The same result should make sense for a solo success, and the shared loss should be clear when the deadline passes before completion.

## Implementation order

26 of 26

## Direct dependencies

[ticket 22](22-award-production-contribution-points.md), [ticket 23](23-award-transport-contribution-points.md), [ticket 24](24-award-refining-contribution-points.md), [ticket 25](25-end-the-match-on-completion-or-timeout.md)

## Acceptance criteria

- After successful swarm completion, show the contribution points each player earned from production, transport, and refining. Rank players by their total contribution points.
- The final result agrees with the public scores after all valid deliveries on the finishing turn, including deliveries beyond the target. Solo completion shows the sole player’s result.
- Use competition ranking. Players with equal totals share the same rank. All players tied for first win. With two tied winners, display 1st, 1st, 3rd. An unfinished swarm after turn 100 shows a shared loss.
