# Actions

## Purpose

Actions are what players do to affect their Empire. Deciding which Action(s) to take is the strategic choice that is core to the game loop.

Supports:

- [GDDR 003-turn-based](../decisions/003-turn-based.md)
- [GDDR 004-legacy-as-win-condition](../decisions/004-legacy-as-win-condition.md)
- [GDDR 005-ideological-axes](../decisions/005-ideological-axes.md)
- [GDDR 006-card-like-actions](../decisions/006-card-like-actions.md)
- [GDDR 007-asymmetric-play](../decisions/007-asymmetric-play.md)

Relates to:

- [System 001-turns](./001-turns.md)
- [System 002-legacy](./002-legacy.md)
- [System 004-ideological-alignment](./004-ideological-alignment.md)
- [System 005-political-regime](./005-political-regime.md)

## Core Concepts

| Concept   | Definition                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Action    | What the player chooses their Empire should do this turn. There are 3 types of Actions: Agendas, Directives and Legacies. |
| Agenda    | A broad Action that shifts the Empire's Ideological Alignments                                                            |
| Directive | A specific Action that exploits the Empire's Ideological Alignments without affecting them                                |
| Legacy    | An action to achieve a Legacy Project. See [System 002-legacy](./002-legacy.md)                                           |
| Influence | Resource that all Actions cost. See [System 005-political-regime](./005-political-regime.md)                              |

## Rules

Actions are submitted each turn by players.

There are 3 types of Actions:

- Agendas
- Directives
- Legacies

The different Action types only differ in scope and flavor. Aside from that, all actions have the same card-like shape:

- They have a type (Agenda/Directive/Legacy)
- They have a tier (Basic/Standard/Improved/Advanced/Exceptional)
- They may have pre-condition(s)
- They have source(s)
- They have target(s)
- They have cost(s)
- They have effect(s)

All Actions cost Influence, and usually cost additional resources. The player's Political Regime will affect the Influence Cost and the Action's efficiency.

The available Action pool every turn will be dictated by the player's ideological alignments. Every Action in the pool can be used once per turn.

To play an Action, a player will have to meet the pre-conditions, have a valid source, have a valid target and be able to pay the costs. The pre-conditions might be things like "no other Agendas played this turn" or "no other Legacy Project in progress". The Action source and target could be the empire, a planet or a unit.

The costs are spent only when the turn ends, but the player will not be allowed to play Actions that would overspend. A visual indicator will let the user know how much of each resource they have in total, and how much they will have after paying the costs of all their Actions. Whenever an Action is canceled or prevented, the Influence cost is always spent and is never refunded. Other resources may be refunded, depending on the Action.

### Agendas

Agendas are broad Actions, generally Empire or Planet wide, that have a noticeable impact on the player Ideologies. They aim to steer how the Empire as a whole functions over multiple turns.

| Agenda | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Directives

Directives are targeted Actions, generally affecting a Planet or a Unit, that have little to no impact on the player Ideologies. They aim to have concrete, immediate effects.

| Directive            | Tier        | Conditions  | Source  | Target            | Costs                             | Effects                                                                         |
| -------------------- | ----------- | ----------- | ------- | ----------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Attack Move          | Standard    | N/A         | Fleet   | Planet            | 5 Influence, 1 fuel               | Travel at Speed 1, Range 5. Assault on arrival.                                 |
| Attack Move          | Exceptional | N/A         | Fleet   | Planet            | 5 Influence, 5 fuel, 5 energy     | Travel at Speed 5, Range 25. Surprise Assault on arrival.                       |
| Stealth Move         | Standard    | N/A         | Fleet   | Planet            | 3 Influence, 1 fuel, 5 energy     | Travel at Speed 1, Range 3. Cloaked in transit.                                 |
| Stealth Move         | Exceptional | N/A         | Fleet   | Planet            | 3 Influence, 3 fuel, 10 energy    | Travel at Speed 3, Range 9. Cloaked in transit and for 1 turn after arrival.    |
| Post Trade           | Standard    | N/A         | Self    | Trade Board       | 5 Influence, Trade Offering       | Post a Trade Offering for 5 turns with 15% Tax.                                 |
| Post Trade           | Exceptional | N/A         | Self    | Trade Board       | 3 Influence, Trade Offering       | Post a Trade Offering for 10 turns with 0% Tax.                                 |
| Bid on Trade         | Standard    | N/A         | Self    | Open Trade        | 5 Influence, Bid Payment          | Bid at a 100% Rate on an Open Trade.                                            |
| Bid on Trade         | Exceptional | N/A         | Self    | Open Trade        | 3 Influence, Bid Payment          | Bid at a 150% Rate on an Open Trade.                                            |
| Cancel Trade         | Standard    | N/A         | Self    | Own Open Trade    | 1 Influence                       | Cancel the Trade. Refund its Trade Offering unless the Trade settles this turn. |
| Post Contract        | Standard    | N/A         | Self    | Contract Board    | Contract Reward                   | Post a Contract for 3 turns with a 100% Reward Rate.                            |
| Post Contract        | Exceptional | N/A         | Self    | Contract Board    | Contract Reward                   | Post a Contract for 6 turns with a 200% Reward Rate.                            |
| Bid on Contract      | Standard    | N/A         | Self    | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 100% of your Bid Reward.                   |
| Bid on Contract      | Exceptional | N/A         | Self    | Open Contract     | Action Costs                      | Bid to complete an Open Contract for 200% of your Bid Reward.                   |
| Cancel Contract      | Standard    | N/A         | Self    | Own Open Contract | 1 Influence                       | Cancel the Contract. Refund its escrow unless the Contract settles this turn.   |
| Colonize Planet      | Standard    | N/A         | Fleet   | Unclaimed Planet  | 25 Influence, 1 colony            | Travel at Speed 1, Range 5. Colonize on arrival.                                |
| Colonize Planet      | Exceptional | N/A         | Fleet   | Unclaimed Planet  | 25 Influence, 1 colony, 20 energy | Travel at Speed 5, Range 5. Colonize on arrival. Develop at 200% for 10 turns.  |
| Build Infrastructure | Standard    | N/A         | Self    | Owned Planet      | 10 Influence, Infrastructure Cost | Build Standard or lower Infrastructure.                                         |
| Build Infrastructure | Exceptional | N/A         | Self    | Owned Planet      | 10 Influence, Infrastructure Cost | Build Exceptional or lower Infrastructure.                                      |
| Build Fleet          | Standard    | N/A         | Self    | Owned Planet      | 10 Influence, 5 Metal             | Build a Fleet with Strength 5.                                                  |
| Build Fleet          | Exceptional | N/A         | Self    | Owned Planet      | 10 Influence, 20 Metal            | Build a Fleet with Strength 20.                                                 |
| Merge Fleets         | Standard    | Same Planet | Fleet A | Fleet B           | 5 Influence, 5 Metal, 5 Energy    | Merge Fleet A onto Fleet B.                                                     |
| ...                  | ...         | ...         | ...     | ...               | ...                               | ...                                                                             |

### Legacies

Legacies are big undertakings that span multiple turns. They reward a lot of Legacy points when they complete their Legacy Project.

| Legacy | Tier | Conditions | Source | Target | Costs | Effects |
| ------ | ---- | ---------- | ------ | ------ | ----- | ------- |
| ...    | ...  | ...        | ...    | ...    | ...   | ...     |

### Mechanics and Keywords

Action effects use keywords and defined game terms as shorthand for the complete rules below.

#### Trade

A **Trade Offering** specifies a fixed resource and amount offered by its **Seller**, and a fixed resource and amount requested in return. The offered resource is immediately placed in escrow when the Trade is posted.

**Post a Trade Offering for X turns with Y% Tax** creates an **Open Trade** on the Trade Board. It remains open until it settles, is cancelled, or its duration ends. If it expires without settling, its Trade Offering is returned to the Seller in full.

**Bid at an X% Rate on an Open Trade** submits a private bid for that Trade. The minimum bid is the Trade's requested amount. The Buyer places the Trade's requested resource and amount in escrow as its **Bid Payment**. Bids are not visible to other players before turn resolution.

At turn resolution, the highest valid bid wins. If several bids tie for the highest rate, one is selected randomly. The winning Buyer receives the Trade Offering. The Seller receives the requested amount multiplied by the winning rate, minus the Trade's Tax. The system creates any amount above the requested amount that the Seller receives because of a Rate above 100%. The Taxed amount is removed from the game.

When bidding alone, the Trade's requested amount bid is paid. Overbidding alone does not cost you more.

All losing Bid Payments are returned in full. The Influence spent to submit a Bid is not refunded.

**Cancel the Trade** cancels the Seller's own Open Trade and returns its Trade Offering in full. If a valid Bid settles that Trade in the same turn resolution, settlement takes priority and the cancellation has no effect. Its Influence cost is still spent.

#### Contract

A **Contract** is a public request for another empire to perform a specified Action on behalf of its **Client**. The Client fixes the Action and its target. The winning contractor chooses an eligible source it owns.

A **Contract Reward** is a fixed resource and amount held in the Client's escrow when the Contract is posted. **Post a Contract for X turns with a Y% Reward Rate** creates an **Open Contract** on the Contract Board with a visible reward equal to the Contract Reward multiplied by Y%. It remains open until it settles, is cancelled, or its duration ends. Any unspent escrow is returned to the Client when an Open Contract is cancelled or expires.

A contractor submits a private **Bid Reward** when it **Bids to complete an Open Contract for X% of its Bid Reward**. The bidder must have the requested Action available, choose an eligible source, and be able to pay all normal costs for that Action. The Bid reserves and submits that Action, so it cannot be used again that turn.

At turn resolution, the lowest valid Bid Reward wins. If several bids tie for the lowest reward, one is selected randomly. Only the winner performs the requested Action and pays its non-Influence action costs. Losing bidders recover their action-specific escrowed resources. Influence is never refunded.

The Client receives the requested Action's effects and attribution. The contractor retains its source unless the Action destroys or consumes it. For example, a contracted Colonize Planet action uses the contractor's fleet but grants the Planet to the Client; a contracted attack affects diplomatic relationships on the Client's behalf.

The contractor's payout is the lower of the Contract's visible reward and its Bid Reward multiplied by the Bid's payout rate. A Standard Post Contract's visible reward equals the Client's escrow. An Exceptional Post Contract displays a visible reward equal to twice the Client's escrow; the system matches a payout only when it exceeds that escrow. The system never pays more than the visible reward.

**Cancel the Contract** cancels the Client's own Open Contract. If a valid Bid settles that Contract in the same turn resolution, settlement takes priority and the cancellation has no effect. Its Influence cost is still spent.

#### Colonize

**Colonize on arrival** means that, when the fleet arrives at an Unclaimed Planet, the Planet becomes owned by the Action's empire and the fleet is consumed.

If multiple valid Colonize actions arrive at the same Unclaimed Planet during one turn resolution, one is selected randomly to succeed. The other actions fail: their fleets remain intact and their non-Influence resources are returned. Influence is still spent.

**Develop at X% for Y turns** means that a successfully colonized Planet uses X% of its normal development rate for Y turns. The initial state of a newly colonized Planet and the details of Planet development are not yet defined.

#### Infrastructure

**Build X or lower Infrastructure** means the Action may build one Infrastructure whose tier is X or lower on a Planet owned by the empire receiving the Action's effects. The Action pays that Infrastructure's listed **Infrastructure Cost**.

The Infrastructure catalogue, its individual effects, and its construction prerequisites are not yet defined.

#### Fleet

A **Fleet** has one stat: a positive whole-number **Strength**. A Fleet whose Strength reaches 0 disappears.

**Build a Fleet with Strength X** creates a new Fleet with Strength X at the target Owned Planet.

**Merge Fleet A onto Fleet B** requires two Fleets owned by the same empire at the same Planet. Fleet A is consumed and its full Strength is added to Fleet B. Fleet Strength has no maximum.

#### Fleet Combat

When a Fleet assaults a Planet, the attacking Fleet fights all Enemy Fleets at that Planet as one combined defending force. In normal combat, each side loses Strength equal to the other side's total Strength, capped at its own total Strength.

If a side contains multiple Fleets, its total Strength loss is distributed proportionally across those Fleets. Losses always use whole numbers. Some rounding might be required but the total losses are always respected.

**Surprise Assault on arrival** resolves in two steps. First, the attacking Fleet deals its Strength as loss to the combined defending force. Then, only the surviving defending Strength deals loss to the attacker. If no defending Strength remains, there is no retaliation.

#### Travel

**Travel at Speed X, Range Y** means the action may target a Planet whose travel distance from the fleet is no greater than Y light-years. The fleet travels toward that Planet by up to X light-years each turn until it arrives.

- **Speed X** is the maximum number of light-years the fleet travels per turn.
- **Range Y** is the maximum travel distance allowed between the fleet and the target Planet. A Planet beyond that distance is not a valid target.
- A fleet is **in transit** from the moment it departs until immediately before it arrives.
- A fleet **arrives** when it reaches the target Planet. It is no longer in transit before any arrival effects resolve.

#### Assault

A fleet with **Assault on arrival** will attack all Enemy Fleets present at the destination.

#### Surprise Assault

A fleet with **Surprise Assault on arrival** resolves its attack under the Surprise Assault rule in Fleet Combat.

#### Cloaked

A **Cloaked** fleet and all information about it are hidden from Enemy players. Enemy players cannot target it.

An effect that keeps a fleet Cloaked for 1 turn after arrival ends at the end of the first turn after the fleet arrives.

## Potential Flaws

Players might have access to too many actions at the same time, making it overwhelming and hard to choose which actions should be played.
