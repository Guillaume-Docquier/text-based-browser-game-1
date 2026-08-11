# Contracts

## Status

Not Implemented

## Purpose

Contracts are a public commission market. An empire can offer a reward for another empire to carry out specified work on its behalf, allowing an Empire to benefit from Actions it would otherwise not be able to.

Supports:

- [GDDR 003-turn-based](../decisions/003-turn-based.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)
- [System 002-legacy](./002-legacy.md)
- [System 014-resources](./014-resources.md)
- [System 015-rules-engine](./015-rules-engine.md)

## Core Concepts

| Concept         | Definition                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Client          | The empire that creates a Contract and receives the commissioned work's effects and attribution. |
| Contractor      | The empire that wins a Contract bid and carries out the commissioned work.                       |
| Contract Reward | A fixed resource and amount held in the Client's escrow.                                         |
| Open Contract   | A public Contract listed on the Contract Board until it settles, is withdrawn, or expires.       |
| Bid Reward      | The reward amount that a Contractor requests for completing a Contract.                          |
| Reward Rate     | The multiplier used to determine an Open Contract's visible reward.                              |
| Payout Rate     | The multiplier used to determine a winning Contractor's payout.                                  |

## Contract Board

The game provides a dedicated Contract Board view for browsing Open Contracts. It shows the requested Action, fixed target, visible reward, and remaining duration. It does not reveal private bids before settlement.

## Rules

A Client creates a Contract by defining the requested Action and its fixed target, then placing the Contract Reward in escrow. An Open Contract remains on the Contract Board for its listed duration. If it expires or is withdrawn without settlement, the unspent escrow returns to the Client.

The Client may not bid on its own Contract. Each empire may submit at most one bid per Open Contract. Contractors may place private bids on an Open Contract. A Contractor supplies an eligible source it owns, has the requested Action available, and meets that Action's normal requirements and costs. On submission, bidding reserves and submits the Action, so it cannot be used again that Turn. Its Action Costs are reserved from submission, making those Resources unavailable for other use until the Contract settles or the reservation is released. The source remains under the Contractor's ownership unless the work consumes or destroys it.

At Turn Resolution, the lowest valid Bid Reward wins. Tied lowest Bid Rewards select one winner randomly. Only the winning Contractor performs the requested Action, and its reserved Action Costs are consumed to settle the Contract. Its effects and attribution apply to the Client.

A Contract's payout is the lower of its visible reward and its Bid Reward multiplied by the Bid's Payout Rate. A Standard Contract has a visible reward equal to the Client's escrow. An Exceptional Contract has a visible reward equal to twice the Client's escrow; the system matches payout only when it exceeds the escrow, and never beyond the visible reward.

Action Costs reserved by losing bids are released in full after settlement. If a Contract expires or is withdrawn without settlement, all reserved Action Costs are released in full. A settlement takes priority over a withdrawal requested during the same resolution.

## Potential Flaws

The system-funded payout supplement from Exceptional Contracts can become an exploitable resource source if Exceptional contract availability is not scarce enough.
