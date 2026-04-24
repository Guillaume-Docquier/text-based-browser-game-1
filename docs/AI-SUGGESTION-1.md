# Proposed Game Design - Cosmic Empires

This document proposes a concise, implementation-oriented game design for Cosmic Empires. It is intended to tighten the current direction from `docs/MVP.md` and expand the incomplete ideas in `docs/GAME-DESIGN.md` into a coherent default `Ruleset`.

The proposal keeps the MVP commitments intact:

- three playable `Institution` types: `Empire`, `Corporation`, `Faith`
- long `Turn` cadence with deterministic, server-authoritative `Tick` resolution
- hidden ownership and partial information
- one `Total Score` across all `Institutions` owned by a `Player`
- desktop-first, text-first strategy presentation

# Design Goals

- Create meaningful asymmetry between `Empire`, `Corporation`, and `Faith`.
- Make military, economic, political, and ideological play all viable.
- Keep the game readable through text, numbers, and logs rather than heavy visuals.
- Let the default `Ruleset` be deep enough to be interesting but structured enough to remain data-driven.

# Core Premise

Each `Player` acts as the strategic mind behind a network of `Institutions`. An `Empire` governs `Territory` and Population, a `Corporation` monetizes `Resources` and specialized services, and a `Faith` spreads `Influence`, gathers intelligence, and shapes social outcomes.

The map is a `Star System` made of `Stars`, `Planets`, `Moons`, and `Asteroids`. `Institutions` expand through `Sites`, `Infrastructure`, `Units`, diplomacy, and covert positioning. All meaningful decisions are submitted during a `Turn` and resolved together during a `Tick`.

# World Model

## Map Objects

### `Star`

The anchor of a `Star System`.

- Holds one or more `Orbits`.
- Determines broad environmental traits for nearby `Sites`.
- Cannot be owned directly.
- Exists to organize travel, adjacency, and scarcity.

### `Planet`

The main inhabited or inhabitable `Celestial Body`.

- May contain Population, `Infrastructure`, `Garrisons`, and multiple `Sites`.
- Can be claimed, governed, taxed, developed, blockaded, converted, or invaded.
- Is the primary source of political control and Population-based scoring.

### `Moon`

A secondary `Celestial Body` attached to a `Planet`.

- Usually smaller and more specialized than a `Planet`.
- Often optimized for extraction, shipyards, defense, or hidden operations.
- Can be claimed and developed separately from its parent `Planet`.

### `Asteroid`

A low-habitability `Celestial Body` focused on extraction and logistics.

- Usually poor for Population but rich in industrial `Resources`.
- Best used for mining, refining, depots, hidden bases, and route control.

### `Site`

A usable location on a `Celestial Body`.

- Represents a settlement zone, mine, port, shrine, habitat, orbital anchor, or similar node.
- Can host `Infrastructure`, stationed `Units`, and ownership markers.
- Is the smallest map object that commonly changes hands.

## Political Objects

### `Territory`

An `Empire` claim over one or more `Sites` on a `Planet`, `Moon`, or `Asteroid`.

- Defines public political control.
- Enables taxation, law, conscription, and diplomatic obligations.
- Can be contested without every underlying `Site` immediately changing hands.

### `Population`

The civilian body living in a `Territory`.

- Produces labor, tax base, legitimacy, and vulnerability.
- Has loyalty, unrest, and susceptibility to `Influence`.
- Is central to both `Empire` stability and `Faith` growth.

## Institution Objects

### `Empire`

The territorial and political `Institution`.

- Owns or governs `Territory`.
- Maintains law, diplomacy, military posture, and taxation.
- Scores mainly from Population, controlled `Territory`, and strategic position.

### `Corporation`

The economic and industrial `Institution`.

- Operates through `Contracts`, extraction, logistics, manufacturing, and specialized services.
- May be public, affiliated, or secretly controlled.
- Scores mainly from profitable networks, fulfilled `Contracts`, and industrial leverage.

### `Faith`

The ideological and influence `Institution`.

- Operates through `Doctrine`, conversion, intelligence, unrest shaping, and social pressure.
- Can be hidden, tolerated, outlawed, or state-backed.
- Scores mainly from sustained `Influence`, fulfilled hidden `Agendas`, and strategic conversion outcomes.

## Operational Objects

### `Unit`

A mobile or semi-mobile game piece controlled by an `Institution`.

Default `Unit` classes:

- `Fleet`: military or transport force that moves between `Orbits` and `Sites`
- `Agent`: covert operative for infiltration, sabotage, and intelligence
- `Missionary`: `Faith` operative for conversion and doctrinal actions
- `Convoy`: economic logistics piece for trade and hauling
- `Colony Ship`: expansion piece used to found new `Sites`

### `Infrastructure`

A persistent built asset on a `Site`.

Default `Infrastructure` classes:

- `Habitat`: supports Population growth
- `Mine`: extracts raw `Resources`
- `Refinery`: converts raw `Resources` into higher-value outputs
- `Shipyard`: builds or repairs `Units`
- `Fortress`: raises defense and slows invasion
- `Temple`: increases `Faith` `Influence`
- `Market`: boosts trade and `Contract` capacity
- `Relay`: improves logistics, range, and information flow
- `Research Lab`: improves `Technology` progress

### `Technology`

A persistent unlock that changes action access, yields, visibility, or resolution priority.

- Usually researched by `Corporations` and adopted by `Empires`.
- Some `Faith` doctrines can function as ideological `Technology`.

### `Treaty`

A formal diplomatic agreement.

- Public by default.
- Defines access, peace, war, tribute, border rights, or voting commitments.

### `Contract`

A formal economic agreement.

- Usually created by a `Corporation`.
- Defines delivery terms, service obligations, pricing, and deadlines.

### `Doctrine`

A `Faith` or `Empire` policy package that modifies behavior.

- `Empire` `Doctrines` shape law, taxation, militarization, and tolerance.
- `Faith` `Doctrines` shape conversion, secrecy, and social effects.

# Turn Structure

## `Turn`

The `Player` planning phase before resolution.

During a `Turn`, a `Player`:

- reviews the latest `Event Log`
- inspects visible state and inferred changes
- negotiates with other `Players`
- assigns `Actions` to each owned or affiliated `Institution`
- marks ready or waits for the timer

## `Tick`

The deterministic server resolution step.

Suggested default resolution order:

1. upkeep and validity checks
2. diplomatic state changes
3. movement
4. trade and logistics
5. extraction and production
6. construction and repair
7. conversion and influence
8. covert actions
9. combat and invasions
10. scoring updates, `Event Log`, next `Turn`

## Special Vote Cycle

Every X `Ticks`, trigger a `Council Vote`.

- Eligible `Empires`, `Corporations`, and `Faiths` vote with weighted influence.
- Outcomes modify the whole `Ruleset` state for a fixed duration.
- Example outcomes: trade boom, anti-war charter, research subsidy, anti-conversion edict.

This preserves the idea from `GAME-DESIGN.md` while keeping it discrete and data-driven.

# Action Model

Each `Institution` has its own `Action Pool`. `Actions` are submitted per `Turn`, cost `Action Points`, may also cost `Resources`, and can have cooldowns, prerequisites, and multi-`Tick` durations.

Default `Action Pool` sources:

- `Empire`: based on governed Population, administrative capacity, and key `Infrastructure`
- `Corporation`: based on active operations, logistics network, and owned `Units`
- `Faith`: based on influenced Population, active `Temples`, and doctrinal reach

Unused `Action Points` may be partially banked if allowed by the `Ruleset`.

# Actions By Object

## `Empire` Actions

### Always available if the `Empire` is active

- `Set Policy`: choose or change an `Empire Doctrine`
- `Negotiate Treaty`: propose, accept, or break a `Treaty`
- `Declare Stance`: set peace, cold war, embargo, or war posture
- `Allocate Budget`: move `Resources` between military, civil, and diplomatic priorities

### Available on controlled `Territory`

- `Tax Territory`: collect revenue; raises unrest if overused
- `Subsidize Territory`: lower unrest or boost growth
- `Colonize Site`: claim an unclaimed habitable `Site`; requires a viable `Site` and expansion capability
- `Annex Site`: convert occupied or protectorate control into direct rule
- `Conscript Population`: create military capacity; increases instability
- `Enforce Law`: reduce unrest and covert activity
- `Relax Law`: improve loyalty growth and trade openness
- `Authorize Construction`: allow new `Infrastructure`
- `Upgrade Infrastructure`: improve an existing `Infrastructure`
- `Fortify Territory`: add defensive readiness before expected conflict

### Available when military assets are present

- `Mobilize Fleet`: ready a `Fleet` for movement or combat
- `Invade Territory`: attempt to seize control of defended `Sites`
- `Bombard Site`: damage `Infrastructure` and defenders from orbit
- `Lift Blockade` / `Impose Blockade`: control trade and movement around a target `Planet`, `Moon`, or `Asteroid`

## `Corporation` Actions

### Always available if the `Corporation` is active

- `Offer Contract`: create a `Contract` for supply, transport, protection, or construction
- `Accept Contract`: commit to another party's offer
- `Cancel Contract`: terminate a cancellable `Contract`, usually with penalty
- `Set Pricing`: adjust margins and competitiveness
- `Fund Research`: direct capital toward a `Technology`

### Available on owned or leased `Sites`

- `Survey Resource`: reveal hidden yields or strategic traits
- `Extract Resource`: gather raw `Resources` from a `Mine` or similar `Infrastructure`
- `Refine Resource`: transform raw inputs into advanced materials
- `Build Infrastructure`: create `Mine`, `Market`, `Relay`, `Research Lab`, or `Shipyard`
- `Upgrade Infrastructure`: increase throughput, storage, or resilience
- `Open Trade Route`: establish recurring logistics between two `Sites`
- `Stockpile Goods`: store outputs for future delivery or war economy

### Available with the right `Units`

- `Move Convoy`: reposition cargo along a valid route
- `Deliver Contract`: satisfy a `Contract` milestone
- `Deploy Colony Ship`: found a new extraction or settlement `Site`
- `Repair Fleet`: service damaged friendly `Units` at a valid `Site`
- `License Technology`: share a `Technology` with another `Institution` for payment or leverage

## `Faith` Actions

### Always available if the `Faith` is active

- `Set Doctrine`: choose or change a `Doctrine`
- `Declare Agenda`: commit to a public or hidden strategic focus
- `Petition Empire`: request tolerance, subsidy, or legal recognition

### Available where the `Faith` has presence

- `Convert Population`: increase `Influence` in a target `Territory`
- `Establish Temple`: create a `Temple` on a tolerated or covert `Site`
- `Spread Doctrine`: improve growth or unlock a local doctrinal effect
- `Agitate`: raise unrest in a target `Territory`
- `Pacify`: reduce unrest where the `Faith` is aligned with local authority
- `Sanctify Site`: increase defensive morale, legitimacy, or doctrinal scoring

### Available with covert reach or specialized `Units`

- `Gather Intel`: reveal hidden affiliation, defenses, or planned action categories
- `Infiltrate Institution`: plant persistent covert access on an `Empire` or `Corporation`
- `Sabotage Infrastructure`: reduce efficiency or disable a target asset
- `Smuggle Resource`: bypass blockades or taxes
- `Expose Secret`: reveal hidden ownership or agreement at the right moment

## `Planet` Actions

A `Planet` does not act independently. It provides location-bound actions to the controlling `Empire` and present `Institutions`.

Available when the required controller or presence exists:

- `Grow Population`
- `Build Infrastructure`
- `Fortify Territory`
- `Convert Population`
- `Launch Fleet`
- `Impose Blockade`

## `Moon` Actions

A `Moon` provides specialized location-bound actions.

Available when the required controller or presence exists:

- `Extract Resource`
- `Build Infrastructure`
- `Fortify Territory`
- `Hide Unit`
- `Launch Fleet`

## `Asteroid` Actions

An `Asteroid` provides industrial and covert location-bound actions.

Available when the required controller or presence exists:

- `Survey Resource`
- `Extract Resource`
- `Build Infrastructure`
- `Hide Unit`
- `Stockpile Goods`

## `Star` Actions

A `Star` does not take `Actions`. It only affects map structure, travel, and environmental modifiers defined by the `Ruleset`.

## `Unit` Actions

### `Fleet`

- `Move`: during movement resolution
- `Patrol`: remain on route and raise detection
- `Escort`: protect `Convoys` or invasions
- `Attack`: engage hostile `Units` or defenders during combat
- `Bombard`: attack a defended `Site`
- `Transport`: carry invasion, colony, or logistics payloads

### `Agent`

- `Move`
- `Infiltrate Institution`
- `Gather Intel`
- `Sabotage Infrastructure`
- `Steal Research`
- `Exfiltrate`

### `Missionary`

- `Move`
- `Convert Population`
- `Establish Temple`
- `Spread Doctrine`
- `Pacify`
- `Agitate`

### `Convoy`

- `Move`
- `Load Goods`
- `Unload Goods`
- `Deliver Contract`
- `Smuggle Resource`

### `Colony Ship`

- `Move`
- `Deploy Colony Ship`
- `Found Site`

## `Infrastructure` Actions

`Infrastructure` does not choose actions on its own. It grants actions to the owning or occupying `Institution`.

### `Habitat`

- enables `Grow Population`
- enables higher local workforce and tax base

### `Mine`

- enables `Extract Resource`

### `Refinery`

- enables `Refine Resource`

### `Shipyard`

- enables `Build Unit`
- enables `Repair Fleet`

### `Fortress`

- enables `Fortify Territory`
- increases defense during invasion and blockade

### `Temple`

- enables `Convert Population`
- enables `Spread Doctrine`

### `Market`

- enables `Open Trade Route`
- improves `Contract` throughput

### `Relay`

- enables extended logistics and intelligence support

### `Research Lab`

- enables `Fund Research`
- enables faster `Technology` completion

# Information Model

The game should clearly separate public state, hidden state, and inferred state.

## Public by default

- `Empire` ownership of `Territory`
- visible `Infrastructure`
- most military movement outcomes
- public `Treaty` terms
- `Council Vote` outcomes
- high-level score summary if the `Ruleset` allows it

## Hidden or partially hidden

- `Corporation` and `Faith` ownership
- submitted `Actions` before `Tick` resolution
- covert `Unit` positions
- hidden `Agendas`
- exact yields from unsurveyed `Sites`

## Revealed through play

- allegiance inferred from trade, protection, or coordinated timing
- hidden assets exposed through `Gather Intel`, `Expose Secret`, combat, or politics

# Scoring

The winner is the `Player` with the highest `Total Score` at game end.

## `Total Score` Principles

- Every owned or affiliated `Institution` contributes.
- Scores should reward different strategies, not only conquest.
- Hidden play matters, but the score must remain explainable after game end.

## Default Score Sources

### `Empire` Score

- controlled `Territory`
- governed Population
- strategic `Sites` held at game end
- diplomatic prestige from successful `Treaty` networks
- stability bonus for low unrest and coherent rule

### `Corporation` Score

- fulfilled `Contracts`
- profitable trade volume
- industrial output
- valuable `Technology` holdings
- maintained service dependencies with other `Institutions`

### `Faith` Score

- sustained `Influence` across Population centers
- completed hidden or declared `Agendas`
- conversion control of key `Territory`
- doctrinal effects achieved through unrest, pacification, or legitimacy shifts

## Recommended End Conditions

The default `Ruleset` should support one or more of:

- fixed `Tick` count
- target `Total Score`
- concession by all but one `Player`

# Game Views

The UI should be organized around readable, text-first strategic surfaces.

## Required Views

### `Lobby View`

- `Players`, readiness, selected `Ruleset`, game status

### `Galaxy View`

- high-level map of `Star Systems`, control, routes, and major alerts

### `Star System View`

- `Star`, `Planet`, `Moon`, and `Asteroid` layout
- ownership, presence, routes, and unresolved tension points

### `Celestial Body View`

- detailed view for a `Planet`, `Moon`, or `Asteroid`
- `Sites`, `Infrastructure`, Population, local defenses, and available actions

### `Empire View`

- `Territory`, laws, military posture, unrest, taxation, diplomacy

### `Corporation View`

- `Contracts`, production chains, logistics, profits, and `Technology`

### `Faith View`

- `Influence`, `Doctrine`, covert reach, `Agendas`, tolerated presence

### `Diplomacy View`

- `Treatys`, offers, relationships, negotiations, and vote positioning

### `Contracts View`

- open, active, fulfilled, and breached `Contracts`

### `Research View`

- available `Technology`, progress, prerequisites, and licensing state

### `Orders View`

- current `Turn` submissions by `Institution`
- `Action Pool` usage, costs, conflicts, and readiness state

### `Event Log View`

- resolved `Tick` outcomes with filters for combat, trade, diplomacy, covert actions, and scoring

### `Score View`

- current or end-game `Total Score` breakdown, subject to visibility rules

### `Messages View`

- direct diplomacy and negotiation history between `Players`

# Recommended Ruleset Defaults

- 3 to 6 `Players`
- 1 to 3 `Institutions` per `Player` depending on game size
- 1 to 3 `Turns` per day
- hidden `Corporation` and `Faith` ownership by default
- fixed-duration game with final `Total Score`
- one `Council Vote` every 5 to 8 `Ticks`

# Implementation Notes

- Keep actions object-driven and data-driven: the UI should ask the `Ruleset` what a selected object can do now.
- Treat `Planet`, `Moon`, and `Asteroid` actions as context-sensitive grants, not autonomous actors.
- Keep logs explicit enough that players can understand why a `Tick` resolved the way it did.
- Post-game summaries should reveal all hidden ownership and all hidden score sources.

# Glossary

- `Action`: A command submitted during a `Turn`.
- `Action Point`: The capacity used to submit `Actions`.
- `Action Pool`: The available `Action Point` budget for an `Institution`.
- `Agenda`: A declared or hidden strategic objective, especially for a `Faith`.
- `Asteroid`: A resource-focused `Celestial Body`.
- `Celestial Body`: A physical map object such as a `Planet`, `Moon`, or `Asteroid`.
- `Colony Ship`: A `Unit` used to found a new `Site`.
- `Contract`: A formal economic agreement.
- `Corporation`: An economic and industrial `Institution`.
- `Council Vote`: A periodic system-wide vote that modifies the current game state.
- `Doctrine`: A persistent policy or belief package that changes play.
- `Empire`: A territorial and political `Institution`.
- `Event Log`: The record of meaningful resolved outcomes.
- `Faith`: An ideological and influence-based `Institution`.
- `Fleet`: A military or transport `Unit`.
- `Galaxy View`: The high-level strategic map view.
- `Influence`: The ideological hold a `Faith` has over Population or places.
- `Infrastructure`: A persistent built asset on a `Site`.
- `Institution`: A playable entity such as an `Empire`, `Corporation`, or `Faith`.
- `Missionary`: A `Faith` `Unit` used for conversion and doctrinal actions.
- `Moon`: A secondary `Celestial Body` attached to a `Planet`.
- `Orbit`: A positional layer inside a `Star System`.
- `Planet`: A primary inhabited or inhabitable `Celestial Body`.
- `Player`: The real participant controlling one or more `Institutions`.
- `Population`: The civilian body living in a `Territory`.
- `Relay`: An `Infrastructure` type that improves logistics and information flow.
- `Resource`: A spendable or tradable material, currency, or commodity.
- `Ruleset`: The data-driven definition of available mechanics, objects, actions, scoring, and resolution.
- `Site`: A usable location on a `Celestial Body`.
- `Star`: The anchor object of a `Star System`.
- `Star System`: A local map made of a `Star` and nearby `Celestial Body` objects.
- `Technology`: A persistent unlock that modifies capabilities or yields.
- `Territory`: An `Empire` claim over one or more `Sites`.
- `Treaty`: A formal diplomatic agreement.
- `Turn`: The planning window before resolution.
- `Tick`: The deterministic resolution step that advances the game.
- `Total Score`: The final combined score of a `Player` across affiliated `Institutions`.
- `Unit`: A mobile or semi-mobile piece controlled by an `Institution`.
