# Default Ruleset Proposal - Cosmic Empires

This document replaces the earlier broad proposal with a tighter default game design for the MVP. It is intentionally more specific than `docs/MVP.md`: it defines the recommended first shipped `Ruleset`, calls out what should be in scope, and removes mechanics that add implementation cost without clearly improving the core loop.

It does not try to define every future variant. The goal is a good default game that proves the product:

- long-turn multiplayer play works
- `Empire`, `Corporation`, and `Faith` play differently
- hidden ownership and partial information create tension
- deterministic tick resolution is readable
- multiple strategies can score without the game collapsing into pure conquest

# What Changed From The Previous Proposal

The previous version had strong ideas, but the default design was still too wide for an MVP. It mixed future-facing systems with core systems, duplicated actions across object types, and left some crucial rules too vague to implement cleanly.

This revision makes the design smaller and more concrete:

- one solar system, not a galaxy of many star systems
- fewer unit and infrastructure types
- no global `Council Vote` in the default MVP ruleset
- no separate action catalogs for `Planet`, `Moon`, `Asteroid`, `Unit`, and `Infrastructure`
- no open-ended technology tree for the first shipped ruleset
- fixed, readable turn economy with small order counts
- simple resource model
- explicit visibility rules
- explicit capture, influence, and scoring logic

The `Ruleset` model should still be data-driven enough to support richer variants later. The default ruleset should not try to showcase every possible mechanic.

# Design Principles

## 1. The game must be understandable from logs

If a player cannot explain why a tick changed the map, the economy, or the score, the design is too opaque.

## 2. Every `Institution` needs a distinct job

- `Empire` wins space and governs people.
- `Corporation` turns access into money, logistics, and infrastructure.
- `Faith` creates information advantage, social pressure, and hidden leverage.

## 3. The default game must reward cooperation without requiring trust

Players should often benefit from deals, leases, trade, and tolerated presence. They should also have enough uncertainty that every deal carries risk.

## 4. Hidden information should create tension, not bookkeeping

Ownership, plans, covert presence, and some yields can be hidden. Most map state and most resolved outcomes should still be public.

## 5. The first shipped ruleset should favor depth over breadth

It is better to have 20 actions that matter than 80 actions that overlap.

# Default Match Structure

## Recommended Default Match

- `Players`: 3 to 4
- `Turn` cadence: 2 `Turns` per day
- match length: 20 `Ticks`
- end conditions:
  - end of tick 20
  - concession by all but one player

This creates a game that lasts about 10 days by default: long enough for negotiation and long-term planning, short enough to finish reliably.

## Starting Institutions Per Player

Each player starts with:

- 1 public `Empire`
- 1 hidden-owner `Corporation`
- 1 hidden-owner `Faith`

This keeps all three institution types playable from the start, which is important for the MVP identity. The action economy must therefore stay deliberately small.

## Starting Position

Each player starts with:

- 1 home `Planet`
- 2 controlled `Sites` on that planet
- 1 starting `Fleet`
- 1 starting industrial `Site Lease` for their `Corporation`
- 1 starting hidden `Faith Presence` on their own home planet

The rest of the map starts neutral.

# World Model

## Map Scope

The default MVP map is one colonized solar system, not multiple star systems.

That choice removes a lot of complexity:

- no need for galaxy-scale pathfinding
- no need for a separate strategic map layer and local map layer
- fewer travel rules
- easier diplomacy because all players contest the same shared space

## Map Objects

### `Celestial Body`

The main strategic location. The default ruleset uses three body types:

- `Planet`: best for Population and taxation
- `Moon`: best for specialized infrastructure and defense
- `Asteroid`: best for extraction

Each `Celestial Body` has:

- a name
- a type
- a route list to adjacent bodies
- 2 to 4 `Sites`
- zero or more resource tags
- an optional Population value

### `Site`

The smallest ownable map object.

A `Site` can hold:

- public controller if claimed by an `Empire`
- a lease holder if used by a `Corporation`
- public infrastructure
- stationed fleets
- hidden `Faith Presence`

For the default ruleset, most contested play should happen at the `Site` level. A `Celestial Body` matters because it groups sites, routes, and Population.

### `Route`

A connection between two `Celestial Bodies`.

- movement is one route per `Tick`
- routes are public
- blockades affect routes leading to the blockaded body

No fuel, range, or orbit sub-layer is needed in the default ruleset.

# Institutions

## `Empire`

The `Empire` is the only institution that publicly controls territory and Population.

It is responsible for:

- claiming sites
- taxing Population
- authorizing leases
- building defenses
- moving fleets
- declaring war or access agreements

Its strength is overt control. Its weakness is that most of its power is public and politically costly.

## `Corporation`

The `Corporation` is the industrial and logistical institution.

It is responsible for:

- extracting resources
- refining or shipping them
- building economic infrastructure
- signing service contracts
- making other players dependent on it

Its strength is efficiency and leverage. Its weakness is that it usually needs access granted by an `Empire`.

## `Faith`

The `Faith` is the social, covert, and information institution.

It is responsible for:

- building hidden or tolerated presence
- shifting loyalty
- generating unrest or stability
- revealing hidden ownership or plans
- helping an `Empire` indirectly rather than conquering directly

Its strength is asymmetry and deniability. Its weakness is that it does not directly own territory.

# Core Resources

The default ruleset should use only three spendable resource types.

## `Credits`

General economic currency.

Used for:

- contracts
- maintenance
- leases
- some builds
- some diplomatic payments

Main sources:

- `Empire` taxes
- `Corporation` trade and extraction

## `Materials`

Industrial resource used for hard assets.

Used for:

- infrastructure
- fleet construction
- repair

Main source:

- `Corporation` extraction

## `Influence`

Faith and political pressure resource.

Used for:

- conversion
- agitation
- pacification
- intelligence actions
- exposing secrets

Main source:

- `Faith Presence`
- controlled populations already aligned with the `Faith`

Population, unrest, and loyalty are not spendable resources. They are state values.

# Public State And Hidden State

## Public By Default

- all `Empires`
- `Empire` control of `Sites`
- body routes
- public infrastructure
- stationed fleets unless explicitly hidden by a rule
- Population values
- war, peace, access, and lease agreements
- resolved combat outcomes
- resolved construction outcomes
- current score totals if the ruleset exposes live score

## Hidden By Default

- owner of each `Corporation`
- owner of each `Faith`
- submitted orders before tick resolution
- hidden `Faith Presence`
- active covert investigation targets
- specific hidden agenda of a `Faith`

## Reveal Triggers

Hidden ownership or presence can become public through:

- voluntary reveal
- `Expose Secret`
- certain failed covert actions
- combat or capture of a site containing hidden assets
- end-of-game summary

The default game should hide ownership, not the existence of every institution. Players should know that a named `Corporation` or `Faith` exists; they should not always know who controls it.

# Turn Economy

## Order Counts

Each `Institution` has a small fixed order budget per `Turn`.

- `Empire`: 3 orders
- `Corporation`: 2 orders
- `Faith`: 2 orders

No banking in the default ruleset.

This is a deliberate simplification. Dynamic action-point formulas based on planets, moons, units, or population add complexity early and increase snowballing. The default MVP should instead let scaling come from better sites, stronger positions, and better deals.

## Order Structure

Each order has:

- acting `Institution`
- action type
- source object
- target object if needed
- resource cost
- optional condition or dependency

Invalid orders fail safely during resolution and generate a readable log entry. Expected invalid states should not crash tick processing.

# Infrastructure

The default ruleset only needs five infrastructure types.

## `Habitat`

- increases local Population growth
- improves `Empire` taxation over time

## `Mine`

- produces `Materials`

## `Port`

- enables higher trade throughput
- improves lease value and contract delivery

## `Fortress`

- improves site defense
- slows hostile capture

## `Temple`

- improves `Faith Presence`
- increases local `Influence` generation

Anything beyond these five should be considered future content unless it clearly solves an MVP need.

# Units

The default ruleset only needs two public unit types.

## `Fleet`

Owned by an `Empire`.

Used for:

- moving between bodies
- escorting
- blockading
- attacking fleets
- supporting site capture

## `Freighter`

Owned by a `Corporation`.

Used for:

- moving `Materials` and `Credits` value through contracts
- enabling long-distance extraction and delivery

The `Faith` should not require a visible mobile unit for the MVP. Its hidden reach is better represented as `Faith Presence` on sites or bodies. This is both easier to understand and much easier to build.

# Presence, Control, And Access

## `Empire` Control

An `Empire` controls a `Site` if it has successfully claimed or captured it.

An `Empire` controls a `Celestial Body` if it controls more sites on that body than any other empire.

Only an `Empire` can:

- tax Population
- grant a lease
- authorize open `Temple` construction
- publicly fortify a site

## `Corporation` Lease

A `Corporation` does not own territory. It operates through leases.

A lease gives the `Corporation` permission to:

- build economic infrastructure on a site
- extract from that site
- stage `Freighters` there

Leases are public. The `Corporation` owner is not necessarily public.

## `Faith Presence`

`Faith Presence` is the local footprint of a `Faith` on a body.

Each body tracks a presence level for each faith:

- `0`: none
- `1`: hidden contacts
- `2`: organized cell
- `3`: entrenched movement

If the local `Empire` tolerates the `Faith`, presence can become public and a `Temple` may be built. If not tolerated, presence remains hidden until exposed.

# Diplomacy Model

The default MVP should keep diplomacy formal enough to drive the simulation, but simple enough to implement cleanly.

## `Empire` Diplomatic States

Between each pair of `Empires`, track one public state:

- `Peace`
- `Access`
- `War`

Effects:

- `Peace`: no hostile fleet actions, no capture attempts
- `Access`: same as peace, plus route and docking access
- `War`: hostile fleet actions and site capture allowed

## `Lease Agreement`

Public agreement from an `Empire` to a `Corporation` for one site.

## `Service Contract`

Public agreement between institutions for a defined delivery or construction outcome by a deadline.

Examples:

- ship `Materials` to Mars Port by tick 8
- build a `Mine` on Europa East Crater by tick 10

This is enough diplomacy for the MVP. A richer treaty editor can come later.

# Default Actions

The game should expose only actions that are currently valid for the selected object and acting institution.

## `Empire` Actions

### Territorial

- `Claim Site`: take an unclaimed site
- `Grant Lease`: give a `Corporation` access to a controlled site
- `Revoke Lease`: end a lease, usually with a reputation or credit penalty
- `Build Habitat`
- `Build Fortress`

### Governance

- `Tax Population`: gain `Credits`, increase unrest
- `Subsidize Population`: spend `Credits`, reduce unrest
- `Tolerate Faith`
- `Suppress Faith`: reduce hidden or public presence, raise unrest

### Military

- `Move Fleet`
- `Blockade Body`
- `Attack Fleet`
- `Capture Site`
- `Repair Fleet`

`Empire` actions should feel expensive and public. If an empire acts aggressively, everyone should understand it.

## `Corporation` Actions

### Economy

- `Build Mine`
- `Build Port`
- `Extract Materials`
- `Ship Goods`
- `Fulfill Contract`

### Positioning

- `Move Freighter`
- `Survey Site`

### Leverage

- `Offer Contract`
- `Accept Contract`

The MVP does not need pricing minigames, stockpiles with many item classes, or a separate research subsystem. Corporation gameplay should be about access, throughput, and dependency.

## `Faith` Actions

### Presence

- `Seed Presence`
- `Strengthen Presence`
- `Build Temple` if tolerated and valid

### Social Pressure

- `Convert Population`
- `Agitate`
- `Pacify`

### Information

- `Investigate Ownership`
- `Investigate Orders`
- `Expose Secret`

The MVP does not need a separate sabotage layer for many building types. `Faith` should win by shaping society and information, not by duplicating military or industrial gameplay.

# Resolution Order

The default `Tick` should resolve in this order:

1. validate orders and resource costs
2. apply diplomatic state changes and lease changes
3. movement of `Fleet` and `Freighter`
4. blockades
5. extraction and shipping
6. infrastructure completion and repair
7. `Faith Presence`, conversion, agitation, and pacification
8. investigations and secret exposure
9. fleet combat
10. site capture
11. taxes, upkeep, and passive income
12. score update and event log generation

This ordering supports readable cause and effect:

- movement happens before combat
- logistics can be interrupted by blockades
- social pressure lands before military capture is evaluated
- information actions reveal what happened this tick, not what will happen next tick

## Tie-Breaking

When two effects in the same stage conflict, use deterministic tie-breakers:

1. lower action priority value from the `Ruleset`
2. lower game object id
3. lower action id

That tie-break chain should be visible in implementation and logs.

# Combat And Capture

## Fleet Combat

Fleet combat should be simple:

- each `Fleet` has a strength value
- `Fortress` gives defense bonus to the local defender
- blockade support gives a bonus if the attacker controls all incoming routes

Combat result categories:

- attacker wins
- defender wins
- both damaged, neither removed

The MVP does not need ship classes, weapon loadouts, morale, or tactical formations.

## Site Capture

A `Capture Site` order succeeds only if:

- the acting empires are at `War`
- the attacker has surviving fleet presence at the body
- the target site is not protected by a stronger defending result

Capture changes site controller at the end of the tick, not mid-resolution.

# Population, Loyalty, And Unrest

These values are where `Empire` and `Faith` interact.

## `Population`

- exists only on inhabited sites and planets
- grows slowly with `Habitat`
- drives tax value
- contributes to score

## `Loyalty`

Represents how aligned local population is with the controlling `Empire`.

- higher loyalty improves taxation and defense
- lower loyalty makes conversion and unrest easier

## `Unrest`

Represents instability.

Main causes:

- repeated taxation
- suppression
- war damage
- agitation

Main effects:

- reduced tax efficiency
- weaker defense
- easier faith growth

The MVP should use small integer bands or percentages, not highly granular simulation.

# Scoring

The live game should show category totals. Hidden ownership can stay hidden, but the score model itself should not be mysterious.

## `Empire` Score

Primary sources:

- controlled sites
- controlled bodies
- governed Population

Secondary bonus:

- low unrest across controlled Population

## `Corporation` Score

Primary sources:

- extracted `Materials`
- fulfilled `Service Contracts`
- active leased economic sites at game end

## `Faith` Score

Primary sources:

- total `Faith Presence`
- converted Population
- successful `Expose Secret` actions

## Recommended Weighting

The default weights should make all three institutions matter, with a slight preference toward territorial play because it creates the clearest shared conflict.

Recommended target split across a winning player's total score:

- `Empire`: about 45%
- `Corporation`: about 30%
- `Faith`: about 25%

That is not a cap. It is a balance target.

# Hidden Agendas

The MVP should keep one hidden agenda system, but it must stay narrow.

Each `Faith` gets one hidden agenda from a small list at game start.

Examples:

- end the game with presence on 4 different bodies
- expose 2 hidden owners
- achieve majority influence on 2 populated bodies not controlled by your public empire

Why only `Faith` gets a hidden agenda in the default ruleset:

- it matches the institution fantasy
- it gives hidden play a concrete payoff
- it avoids turning every institution into a secret-objective puzzle

`Corporation` and `Empire` scoring should stay mostly public and structural.

# Event Log Requirements

The default ruleset relies heavily on logs. The game needs good ones.

Each resolved event should answer:

- what happened
- where it happened
- which public institutions were involved
- whether the outcome was public knowledge or private knowledge
- why it succeeded or failed at a high level

Examples:

- "Helios Fleet defeated the defense at Europa High Port."
- "A blockade on Ceres disrupted 1 delivery contract."
- "Unrest increased on Mars Central after heavy taxation."
- "A hidden affiliation was exposed: Aurora Shipping is controlled by Player 3."

Do not dump raw engine internals into the player log. The explanation should be readable without exposing hidden data improperly.

# UI Implications

The default MVP UI does not need a large menu of object-specific action pages. It needs a few clear strategic surfaces.

## Required Views

- `Lobby`
- `System Map`
- `Body Detail`
- `Empire`
- `Corporation`
- `Faith`
- `Diplomacy`
- `Orders`
- `Event Log`
- `Score`
- `Messages`

## Important UI Behaviors

- selecting a body shows public state and your private knowledge side by side
- selecting an institution shows only currently valid actions
- the `Orders` view clearly shows order count remaining per institution
- the `Event Log` can be filtered by military, economic, social, and intelligence events
- hidden ownership is never leaked accidentally through UI grouping

# Ruleset Boundaries For MVP

The following should be considered out of scope for the default ruleset unless they become necessary during implementation:

- multi-system galaxy play
- global `Council Vote`
- complex tech tree
- many unit classes
- many infrastructure classes
- detailed production chains
- ship customization
- dynamic action-point formulas tied to many sub-objects
- religion-specific combat units
- espionage sabotage against every asset type
- doctrine trees for every institution

The `Ruleset` architecture may support some of these later. The first shipped ruleset should not depend on them.

# Why This Default Design Is Better

This version is stricter about what the MVP game actually is.

It keeps the strongest parts of the concept:

- three asymmetric institutions
- hidden ownership
- diplomacy and partial information
- deterministic simultaneous turns
- text-first presentation

It also closes several design gaps from the previous proposal:

- the map scale is now explicit
- the starting position is defined
- the turn economy is defined
- the resource model is defined
- visibility rules are defined
- capture and influence are defined
- scoring is more concrete

Most importantly, it removes mechanics that create implementation cost without improving the core loop enough for MVP. The game can already produce negotiation, suspicion, industrial dependency, covert leverage, and open war with the rules in this document. That is enough to prove the idea.

# Glossary

- `Access`: a public diplomatic state allowing route and docking access between two `Empires`
- `Capture Site`: `Empire` action to take control of an enemy site during war
- `Celestial Body`: a `Planet`, `Moon`, or `Asteroid`
- `Credits`: general-purpose currency
- `Faith Presence`: hidden or public local footprint of a `Faith`
- `Fleet`: public military unit controlled by an `Empire`
- `Freighter`: public logistics unit controlled by a `Corporation`
- `Influence`: spendable resource used by `Faith` actions
- `Lease`: public permission for a `Corporation` to operate on a site
- `Materials`: industrial resource used for physical construction
- `Peace`: public diplomatic state that forbids hostile military actions
- `Route`: adjacency link between two bodies
- `Service Contract`: public agreement for delivery or construction by a deadline
- `Site`: smallest ownable location on a body
- `Suppress Faith`: `Empire` action that reduces local `Faith Presence`
- `Tolerate Faith`: `Empire` action allowing public faith activity on controlled population
- `War`: public diplomatic state that allows hostile military actions
