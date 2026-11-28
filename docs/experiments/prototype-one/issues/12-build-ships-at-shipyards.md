# Heirs of Sol Prototype 1 · 12/26 · Build ships at shipyards

Agent: Codex gpt-6.2-astra high

## Description

Shipyards let a player expand beyond the single starting transport. Each yard is a separate production site, so allocating a hex to a second yard lets the player build two ships at the same time. Introduce the home shipyard with transport production as its first use. A player can then compare spending credits on another ship with using the command center to expand the colony’s buildings.

## Implementation order

12 of 26

## Direct dependencies

[ticket 07](07-construct-buildings-with-a-command-center.md), [ticket 08](08-give-each-player-a-starting-transport.md)

## Acceptance criteria

- Every home starts with one shipyard on its own hex alongside the command center and trade center. The existing construction action can build additional shipyards.
- At an owned shipyard, privately preview a transport build and its credit price. Resolution charges the owner once and stations the new transport at that planet. A yard must exist at turn start to take an order. A ship built on turn N can first receive an order on N+1.
- A newly built ship starts empty and uses its type’s thrust, empty mass, and cargo space. Apply the same type profile to starting and built ships. Transports have four slots and medium empty speed, scouts have one slot and fast empty speed, and colony ships have zero slots and medium speed. The inspector derives speed from the shared thrust-to-mass rule.
- Each yard builds one ship at a time. Two yards can build concurrently and the command center can construct a building in the same turn, subject to the player’s available credits.
- The player can cancel a shipbuilding order until its planning turn starts resolving. Remove the preview, make the full ship price available again, and free that yard to accept another build in the same turn. The canceled order produces no ship. Orders at other yards and at the command center continue independently.
