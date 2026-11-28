# Heirs of Sol Prototype 1 · 23/26 · Award transport contribution points

Agent: Codex gpt-6.2-astra high

## Description

Hauling can be shared work. One player might move four raw metals to a refinery and another carry the resulting alloy to the Sun. Score each delivered resource individually. A metal has its own history of LY traveled by hauler. An alloy has its own history for travel after refinement and retains each of its four component metals’ earlier histories. The public score then reflects each hauler’s share of the trip, including work done before the final handoff.

## Implementation order

23 of 26

## Direct dependencies

[ticket 18](18-unload-selected-items-from-a-ship.md), [ticket 19](19-track-hauling-history.md)

## Acceptance criteria

- A delivered metal awards one transport contribution point and a delivered alloy awards six. Divide those contribution points among haulers in proportion to each player’s share of the delivered item’s weighted distance.
- For a raw metal, a hauler’s weight is their recorded LY on that item. For an alloy, calculate each hauler’s weight at delivery as `sum of their LY on the four component metals + 4 × their LY on the alloy itself`. Include detours and repeated legs as recorded. If a player hauled both a component and the alloy, both terms contribute to their weight. Other items in the same shipment are scored independently.
- Award all transport contribution points for every delivery, including each finishing-turn delivery that takes progress past the target. Update public player scores on delivery. For example, Alice carries four metals 1 LY each and Bob carries the resulting alloy 2 LY. Their weights are 4 and 8. Alice earns 6 × 4/12 = 2 transport contribution points and Bob earns 6 × 8/12 = 4.

## Design detail to settle

Agree how fractional shares appear in public scores and how to handle a delivery with zero weighted distance if one is reachable.
