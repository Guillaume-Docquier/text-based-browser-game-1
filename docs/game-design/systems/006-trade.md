# Trade

## Purpose

Trade is the market through which empires exchange fixed quantities of resources. It creates public opportunities to acquire resources without requiring negotiation or a response during the current turn.

Supports:

- [GDDR 003-turn-based](../decisions/003-turn-based.md)

Relates to:

- [System 003-actions](./003-actions.md)
- [System 001-turns](./001-turns.md)

## Core Concepts

| Concept        | Definition                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Seller         | The empire that lists a Trade Offering.                                                                                 |
| Buyer          | The empire whose bid settles a Trade Offering and receives it.                                                          |
| Trade Offering | A fixed resource and amount supplied by the Seller, in exchange for a fixed resource and amount requested from a Buyer. |
| Open Trade     | A Trade Offering listed on the Trade Board until it settles, is withdrawn, or expires.                                  |
| Bid Payment    | The requested resource and amount a Buyer locks for a bid.                                                              |
| Rate           | A multiplier that determines the Seller's gross return from a winning bid.                                              |
| Tax            | The percentage removed from the Seller's gross return.                                                                  |

## Trade Board

The game provides a dedicated Trade Board view for browsing Open Trades. It shows each available offering, its requested resource and amount, its remaining duration, and the information needed to place a bid. It does not reveal private bids before settlement.

## Rules

A Seller lists a Trade Offering by placing the offered resource in escrow. An Open Trade remains on the Trade Board for its listed duration. If it expires or is withdrawn without settlement, its offering returns to the Seller in full.

Buyers may place private bids on an Open Trade. Each bid locks the Trade's requested resource and amount as its Bid Payment. The Buyer always pays that fixed requested amount; the Rate changes the Seller's return, not the Buyer's payment. Bids remain hidden until the turn resolves.

Players can view and accept trades from all players. There is no vision or location requirements to make trades. Resources are transferred instantaneously.

At turn resolution, the highest valid Rate wins. Tied highest Rates select one winner randomly. The winning Buyer receives the Trade Offering. The Seller receives the requested amount multiplied by the winning Rate, minus Tax. The system supplies any amount above the requested amount created by a Rate above 100%. Tax is removed from the game.

Bid Payments from losing bids are released in full. A settlement takes priority over a withdrawal requested during the same resolution.

## Potential Flaws

System-funded rate bonuses may become a dominant source of resources if their availability or values are not carefully balanced.
