# Heirs of Sol Prototype 1 · 20/26 · Refine metal into alloy

Agent: Codex gpt-6.2-astra high

## Description

Refining gives players a choice between delivering metal directly and concentrating a shipment. Four raw metals fill four cargo slots and contribute four swarm progress. The player chooses which four metals to refine, so they control whose production and hauling histories carry into the alloy. They can keep the alloy for local use or send it straight to pickup for a hauler. It fills one slot and contributes six on delivery. A refinery can therefore support a specialist who receives inputs from several producers. The resulting item must retain those producers and prior haulers as well as the refinery owner.

## Implementation order

20 of 26

## Direct dependencies

[ticket 18](18-unload-selected-items-from-a-ship.md), [ticket 19](19-track-hauling-history.md)

## Acceptance criteria

- The existing construction action can build a refinery. A refinery present at turn start can receive one owner-issued refining order per turn. Without an order it stays idle.
- Select exactly four distinct metal items already in the colony’s private drop-off pile at turn start. The owner chooses the output pile for the alloy. Default to private drop-off and allow public pickup. Show the specific refinery, all four inputs, and the destination pile in the private preview.
- Prevent contradictory orders before submission. A metal selected for refining cannot also be released, loaded onto a ship, or assigned to another refinery. Two refineries can each produce one alloy in the same turn using eight distinct inputs. Only the owner can take inputs from drop-off.
- Canceling a pending refining order while the turn is open frees the four metals and the refinery for another order. When an order resolves, consume exactly its selected metals and place one alloy in its selected pile. Metal mined or delivered into drop-off on N is eligible on N+1. A mine configured for pickup places its metal outside the refinery’s input pile. An alloy produced on N is also first eligible for another action on N+1.
- The alloy retains its four selected source metals as components, each with its producer and individual haul history up to refinement. In current vision, players can inspect those histories and the refinery owner. Each input contributes once.
- An alloy occupies one cargo slot and starts its own haul history at zero. If a ship carries it X LY, add X LY for that hauler to the alloy’s own history only. Its four component histories stay as they were at refinement. Delivery scoring reads both levels.
