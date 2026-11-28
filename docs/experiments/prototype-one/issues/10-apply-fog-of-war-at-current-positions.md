# Heirs of Sol Prototype 1 · 10/26 · Apply fog of war at current positions

Agent: Codex gpt-6.2-astra high

## Description

Players know where every body is, but scouting determines what they know about it. For example, after a transport leaves a surveyed colony, its owner can still consult the last observed deposit and buildings. Another player’s ship seen there disappears from view once coverage is lost. Apply the distinction wherever the player looks up that colony, including through the planet list. The Sun stays public so everyone can follow activity at the shared delivery site.

## Implementation order

10 of 26

## Direct dependencies

[ticket 02](02-add-sol-to-the-generated-galaxy.md), [ticket 09](09-move-a-ship-between-bodies.md)

## Acceptance criteria

- An owned planet covers objects at a distance of 3 light-years (LY) or less from its center. A scout, transport, or colony ship covers objects at a distance of 1.5 LY or less from its current position. Loading cargo changes speed only and leaves ship scan range unchanged. Body locations and coordinates remain public. The Sun and ships stationed there are always visible.
- Show current planet attributes and buildings in vision, the last observation after vision is lost, and unknown values for unobserved attributes. Refresh observations when vision returns.
- Show other ships only in current vision. Enforce the same player-specific information in data returned to the player, maps, lists, and inspectors. Within scan range, players can inspect the contents and item histories of both colony piles, including private drop-off. Outside scan range, neither pile has remembered contents. The Sun remains public.
