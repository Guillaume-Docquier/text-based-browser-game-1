# Trade

## Purpose

Trade lets empires exchange resources without requiring them to coordinate during a turn. It creates public opportunities while keeping bids private until simultaneous resolution.

Supports:

- [GDDR 003-turn-based](../decisions/003-turn-based.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)

## Core Concepts

| Concept        | Definition                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Seller         | The empire that creates a Trade Offering.                                                                |
| Buyer          | The empire that wins a bid and receives the Trade Offering.                                              |
| Trade Offering | A fixed resource and amount offered by the Seller, plus a fixed resource and amount requested in return. |
| Open Trade     | A Trade Offering listed on the Trade Board until it settles, is cancelled, or expires.                   |
| Bid Payment    | The requested resource and amount that a Buyer places in escrow for a bid.                               |
| Rate           | The multiplier that determines the Seller's gross return.                                                |
| Tax            | The percentage removed from the Seller's gross return.                                                   |

## Rules

The Seller escrows its Trade Offering when it posts a Trade. An Open Trade remains available for its listed duration. If it expires or is cancelled without settlement, the Trade Offering returns to the Seller in full.

Buyers submit private bids. A bid uses the Trade's requested resource and amount as its Bid Payment. Bids remain hidden until turn resolution.

At turn resolution, the highest valid bid wins. Tied highest rates select one winner randomly. The winning Buyer receives the Trade Offering. The Seller receives the requested amount multiplied by the winning rate, minus Tax. The system creates any amount above the requested amount created by a Rate above 100%. Tax is removed from the game.

When bidding alone, the Buyer pays the requested amount. Overbidding alone does not cost more. Losing Bid Payments return in full, but spent Influence is never refunded.

A Seller can cancel its own Open Trade. A valid Bid that settles during the same resolution takes priority over cancellation.

## Potential Flaws

System-funded rate bonuses may become a dominant source of resources if their availability or values are not carefully balanced.
