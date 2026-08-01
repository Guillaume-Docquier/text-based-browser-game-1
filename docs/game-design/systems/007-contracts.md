# Contracts

## Purpose

Contracts let an empire obtain additional action capacity or capabilities it does not currently have. They make cooperation valuable without requiring players to coordinate while a turn is open.

Supports:

- [GDDR 003-turn-based](../decisions/003-turn-based.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)

## Core Concepts

| Concept         | Definition                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| Client          | The empire that creates a Contract and receives the requested Action's effects.            |
| Contractor      | The empire that wins a Contract bid and performs the requested Action.                     |
| Contract Reward | A fixed resource and amount in the Client's escrow.                                        |
| Open Contract   | A public Contract listed on the Contract Board until it settles, is cancelled, or expires. |
| Bid Reward      | The reward amount that a Contractor requests for completing a Contract.                    |
| Reward Rate     | The multiplier used to determine an Open Contract's visible reward.                        |
| Payout Rate     | The multiplier used to determine a winning Contractor's payout.                            |

## Rules

A Client posts a Contract for a specified Action and fixed target. The Contractor chooses an eligible source it owns. The Contractor must have the requested Action available and pay its normal costs. Bidding reserves and submits that Action, so it cannot be used again that turn.

Bids are private. At turn resolution, the lowest valid Bid Reward wins. Tied lowest bids select one winner randomly. Only the winner performs the requested Action and pays its non-Influence action costs. Losing bidders recover action-specific escrowed resources, but Influence is never refunded.

The requested Action resolves on the Client's behalf. The Client receives its effects and attribution. The Contractor retains its source unless the Action destroys or consumes it.

A Contract's payout is the lower of its visible reward and its Bid Reward multiplied by the Bid's Payout Rate. A Standard Post Contract has a visible reward equal to the Client's escrow. An Exceptional Post Contract has a visible reward equal to twice the Client's escrow; the system matches payout only when it exceeds the escrow, and never beyond the visible reward.

Unspent escrow returns to the Client if the Contract expires or is cancelled. A Client can cancel its own Open Contract, but a valid same-turn winning Bid takes priority.

## Potential Flaws

System matching from Exceptional Contracts can become an exploitable resource source if Exceptional action availability is not scarce enough.
