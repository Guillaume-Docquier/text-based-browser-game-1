# AI Suggestion 2 - MVP Game Design Proposal

This document proposes a concrete MVP game design for Cosmic Empires. It respects [MVP.md](C:/Users/Guillaume/Dev/text-based-browser-game-1/docs/MVP.md) as the source of truth and uses [GAME-DESIGN.md](C:/Users/Guillaume/Dev/text-based-browser-game-1/docs/GAME-DESIGN.md) only as inspiration.

The goal of the MVP is to create a long-turn, deterministic, text-first strategy game where each player openly controls one Empire and may secretly control additional Corporations and Faiths. Military force matters, but it does not dominate by default because economic leverage, ideological pressure, diplomacy and timing all contribute to Total Score.

# Design Pillars

1. The Empire is the public territorial power.
2. The Corporation is the economic specialist.
3. The Faith is the ideological and covert specialist.
4. Every meaningful choice is submitted during a Turn and resolved during a Tick.
5. Ownership secrecy exists only for Corporation and Faith control. It is preserved unless the controlling player declares an Affiliation.
6. The default scoring model rewards breadth: territory, population, economy, logistics, diplomacy and ideological reach.

# Default MVP Structure

## Players and Institutions

- Each player starts with exactly 1 Empire.
- Each player may create up to 2 Corporations during a game.
- Each player may create up to 1 Faith during a game.
- A player may control at most 4 Institutions total.
- Empire ownership is always public.
- Corporation and Faith ownership are hidden unless the Owner publicly declares an Affiliation.
- There is no investigative mechanic that reveals hidden ownership.

## Map Model

The default MVP map is a single Star System containing:

- 1 Star
- 8 Planets
- 12 Moons
- 24 Asteroids

Each Planet belongs to exactly one Orbit around the Star. Each Moon belongs to exactly one Planet. Each Asteroid belongs to exactly one Belt Sector.

## Starting State

Each Empire starts with:

- 1 Home Planet
- control of all Moons attached to its Home Planet
- 12 Population on its Home Planet
- 1 Shipyard Infrastructure
- 1 Industry Infrastructure
- 1 Administration Infrastructure
- 2 Civilian Units
- 1 Military Unit
- 120 Credits
- 40 Metals
- 20 Energy
- 3 Empire Actions per Turn

Neutral space starts with:

- 4 unclaimed Planets
- 4 neutral Moons
- 24 neutral Asteroids
- 4 Pirate Garrisons on outer neutral Planets

No player starts with a Corporation or Faith.

# Resources and Capacity

The default MVP uses 4 Resource types:

- Credits: the generic economic currency
- Metals: used for construction and industrial production
- Energy: used for advanced Infrastructure, logistics and some Faith Actions
- Favour: used only by Faiths

Each Institution has its own Resource pool. Resource transfer between Institutions must use an explicit Action, Contract or Treaty.

Each Institution also has its own Action pool:

- Empire: 3 Empire Actions per Turn, plus 1 additional Empire Action for every 3 Colonized Planets it controls, up to 6 total
- Corporation: 2 Corporation Actions per Turn
- Faith: 2 Faith Actions per Turn, plus 1 additional Faith Action if it has Presence on 4 or more Planets

Unused Actions do not carry over between Turns. Resources do carry over.

# Game Objects

## Star

The Star is a strategic anchor, not a controllable Institution.

State:

- name
- Orbit layout
- solar output rating from 1 to 3

Actions:

- none

Effects:

- solar output sets the maximum number of Solar Array Infrastructure pieces that may be built in the System: 2 per solar output rating
- all inter-Orbit movement is measured relative to the Star

## Planet

A Planet is the primary territorial Object.

State:

- Controller
- Population
- Stability from 0 to 10
- Development Slots: 6
- Resource Yield profile
- Faith Presence by Faith
- Orbit index
- Colonized status

Default yields:

- Core Planet: 6 Credits, 3 Metals, 1 Energy
- Industrial Planet: 4 Credits, 5 Metals, 1 Energy
- Frontier Planet: 5 Credits, 2 Metals, 2 Energy

Actions available through the controlling Empire:

- Colonize: only on an uncolonized Planet with an Empire Civilian Unit present; costs 1 Empire Action, 20 Credits and 10 Metals
- Tax: once per Turn per Planet; costs 1 Empire Action; gains Credits equal to Population; reduces Stability by 1
- Reform: costs 1 Empire Action and 10 Credits; increases Stability by 2, up to 10
- Fortify: costs 1 Empire Action and 15 Metals; grants +2 Defense until the next Tick
- Grant Contract Access: costs 1 Empire Action; allows one named Corporation to build or harvest on the Planet for 3 Ticks
- Restrict Foreign Activity: costs 1 Empire Action; removes all foreign Contract rights on the Planet at the next Tick

Passive effects:

- each Colonized Planet grants +1 Total Score per Tick
- each 5 Population on a Planet grant +1 Total Score per Tick

## Moon

A Moon is a secondary territorial Object with limited Development capacity.

State:

- Controller
- Development Slots: 3
- Resource Yield profile
- parent Planet

Default yields:

- 2 Credits, 2 Metals, 0 Energy

Actions available through the controlling Empire:

- Annex: only on an unclaimed Moon adjacent to a controlled Planet; costs 1 Empire Action and 10 Credits
- Fortify: costs 1 Empire Action and 10 Metals; grants +1 Defense until the next Tick
- Grant Contract Access: costs 1 Empire Action; identical to the Planet Action

Passive effects:

- each controlled Moon grants +1 Metals during resource collection
- each 2 controlled Moons grant +1 Total Score per Tick

## Asteroid

An Asteroid is an extraction Object. It is not Colonized.

State:

- Controller, if claimed
- deposit type
- remaining yield
- Belt Sector

Deposit types:

- Metal-rich: 24 Metals total
- Energy-rich: 12 Energy total
- Mixed: 12 Metals and 6 Energy total

Actions available through an Empire or Corporation with a Unit present:

- Claim: costs 1 Action from the acting Institution; requires no current Controller
- Harvest: costs 1 Action from the acting Corporation; removes up to 4 Metals or 2 Energy from remaining yield
- Contest: costs 1 Empire Action; removes an unfortified foreign claim if the acting Empire has a Military Unit present

Passive effects:

- claimed Asteroids produce nothing without Harvest Actions

## Empire

The Empire is the only always-public Institution. It is the territorial, diplomatic and military center of a player's position.

State:

- public Owner
- treasury
- controlled Planets, Moons and claimed Asteroids
- Units
- Infrastructure
- Treaties
- public Score contribution

Empire Actions:

- Colonize Planet
- Annex Moon
- Move Unit
- Attack Unit
- Bombard Infrastructure
- Invade Planet
- Tax Planet
- Reform Planet
- Fortify Planet or Moon
- Build Infrastructure
- Grant Contract Access
- Restrict Foreign Activity
- Transfer Resources
- Sign Treaty
- Cancel Treaty
- Declare Affiliation with one owned Corporation or Faith
- Found Corporation
- Found Faith

Empire Action timing:

- Founding, Affiliation, Treaty and Contract Actions may be submitted only during the Declaration phase of a Turn
- movement, military and territorial Actions resolve during the Operations phase of the Tick
- economic and administrative Actions resolve during the Governance phase of the Tick

## Corporation

A Corporation is an economic Institution specialized in extraction, logistics, manufacturing and services.

State:

- hidden Owner unless Affiliated
- treasury
- commercial licenses and Contracts
- Units
- Infrastructure
- service reputation from 0 to 10
- public legal identity

Corporation creation requirements:

- costs 1 Empire Action, 40 Credits and 10 Metals
- may only be founded by an Empire
- receives 60 Credits starting capital
- starts unaffiliated by default
- starts with 2 Corporation Actions per Turn
- starts with 1 Freighter Unit

Corporation Actions:

- Move Unit
- Claim Asteroid
- Harvest Asteroid
- Build Infrastructure on a Planet or Moon with Contract Access
- Manufacture Unit
- Transfer Resources
- Offer Contract
- Accept Contract
- Cancel Contract
- Affiliate publicly with an Empire

Corporation restrictions:

- cannot Colonize, Annex, Tax or sign Treaties
- cannot attack, Bombard or Invade
- cannot operate on a Planet or Moon without local control, Contract Access or a valid Contract

Passive effects:

- each fulfilled Contract grants 2 Total Score
- each 20 Credits held by a Corporation grants 1 Total Score, up to 8
- each active Mine, Refinery or Trade Port grants 1 Total Score

## Faith

A Faith is an ideological Institution specialized in Influence, social leverage and covert but non-revealing pressure.

State:

- hidden Owner unless Affiliated
- Favour pool
- Presence by Planet
- Doctrine
- public creed name

Faith creation requirements:

- costs 1 Empire Action, 30 Credits and 10 Energy
- may only be founded by an Empire
- starts with 10 Favour
- starts unaffiliated by default
- starts with 2 Faith Actions per Turn
- chooses 1 Doctrine on creation

Doctrine options:

- Order: stronger Stability Actions
- Prosperity: stronger economic support Actions
- Zeal: stronger conversion Actions

Faith Actions:

- Establish Presence
- Preach
- Support Stability
- Incite Unrest
- Bless Harvest
- Request Donation
- Transfer Favour
- Affiliate publicly with an Empire

Faith Action rules:

- a Faith never directly reveals its Owner through an Action result
- a Faith cannot directly destroy Units or Infrastructure
- a Faith may act on any Planet where it has Presence

Passive effects:

- each Planet with Faith Presence grants 1 Favour during each Tick
- each 3 Planets with Faith Presence grant 2 Total Score
- if a Faith has Presence on 5 or more Planets, it grants +1 Total Score for each active Treaty held by its affiliated Empire, or by its hidden Owner if unaffiliated

## Unit

A Unit is a mobile operational Object. Units belong to an Empire or Corporation.

Unit types:

- Civilian Unit
- Military Unit
- Freighter Unit

Shared Unit state:

- Controller Institution
- location
- move status
- cargo capacity
- defense value

Movement:

- each Unit may move once per Turn
- moving within the same Orbit costs 1 Action
- moving to an adjacent Orbit costs 1 Action and 1 Energy
- moving between a Planet and one of its Moons costs 1 Action

Civilian Unit Actions:

- Colonize Planet
- Build Infrastructure
- Transfer Resources

Military Unit Actions:

- Move
- Attack Unit
- Bombard Infrastructure
- Invade Planet
- Escort Freighter

Freighter Unit Actions:

- Move
- Transfer Resources
- Harvest Asteroid
- Fulfill Contract

## Infrastructure

Infrastructure is a constructed Object that improves production, defense, logistics or institutional reach.

Infrastructure types:

- Administration
- Industry
- Shipyard
- Mine
- Refinery
- Solar Array
- Temple
- Fortress
- Trade Port

Build limits:

- Planet: up to 6 Infrastructure
- Moon: up to 3 Infrastructure
- Asteroid: none

Default build costs:

- Administration: 20 Credits, 5 Metals
- Industry: 25 Credits, 10 Metals
- Shipyard: 30 Credits, 15 Metals
- Mine: 15 Credits, 10 Metals
- Refinery: 20 Credits, 5 Metals, 5 Energy
- Solar Array: 20 Credits, 5 Metals
- Temple: 15 Credits, 5 Metals, 5 Energy
- Fortress: 20 Credits, 15 Metals
- Trade Port: 25 Credits, 10 Metals

Infrastructure Actions and effects:

- Administration: Empire may use Promote Growth once per Turn on that Planet; costs 1 Empire Action and grants +2 Population
- Industry: +4 Metals during collection
- Shipyard: allows Unit manufacture on that Object
- Mine: doubles one local Asteroid Harvest assigned to that Orbit during the Tick
- Refinery: converts 4 Metals into 2 Energy once per Turn
- Solar Array: +3 Energy during collection
- Temple: Faith may Establish Presence on that Planet for 0 Favour
- Fortress: +3 Defense and blocks Contest unless bombarded first
- Trade Port: allows one additional foreign Contract on that Object and grants +4 Credits during collection

# Actions by Phase

Each Tick resolves in this order:

1. Declaration phase
2. Diplomacy phase
3. Operations phase
4. Governance phase
5. Scoring phase

## Declaration phase

Resolves:

- Found Corporation
- Found Faith
- Declare Affiliation
- sign or cancel Treaties
- offer, accept or cancel Contracts

## Diplomacy phase

Resolves:

- Grant Contract Access
- Restrict Foreign Activity
- Request Donation
- Transfer Resources

## Operations phase

Resolves:

- Move Unit
- Claim Asteroid
- Harvest Asteroid
- Attack Unit
- Bombard Infrastructure
- Invade Planet
- Establish Presence
- Preach
- Incite Unrest
- Bless Harvest

## Governance phase

Resolves:

- Tax
- Reform
- Fortify
- Build Infrastructure
- Support Stability
- Promote Growth
- Refinery conversion
- resource collection

## Scoring phase

Resolves:

- passive Total Score gain
- fulfilled Contract scoring
- Treaty scoring
- end-condition checks defined by the Ruleset

# Actions in Detail

## Empire Actions

- Colonize Planet: available if a Civilian Unit is present and the Planet is uncolonized
- Annex Moon: available if the Moon is unclaimed and adjacent to a controlled Planet
- Move Unit: available if the Unit has not moved this Turn
- Attack Unit: available if a Military Unit is present with a hostile target in the same location
- Bombard Infrastructure: available if a Military Unit is present in Orbit around the target
- Invade Planet: available if a hostile Colonized Planet has no defending Military Unit after combat
- Tax: available once per Turn per controlled Planet
- Reform: available on any controlled Planet below 10 Stability
- Fortify: available on any controlled Planet or Moon
- Build Infrastructure: available if a Civilian Unit is present and a Slot is free
- Promote Growth: available once per Turn on a Planet with Administration Infrastructure
- Grant Contract Access: available on any controlled Planet or Moon
- Restrict Foreign Activity: available on any controlled Planet or Moon
- Transfer Resources: available to an owned Corporation or Faith, or to another player through a Treaty
- Sign Treaty: available with another Empire that consents in the same Turn
- Cancel Treaty: available on any current Treaty
- Declare Affiliation: available on any owned Corporation or Faith that is currently hidden
- Found Corporation: available if the Empire controls at least 2 Planets
- Found Faith: available if the Empire controls at least 3 total Planets and Moons

## Corporation Actions

- Move Unit: available if the Unit has not moved this Turn
- Claim Asteroid: available if a Corporation Unit is present and the Asteroid is unclaimed
- Harvest Asteroid: available if the Corporation controls the Asteroid or has a valid Contract to harvest it
- Build Infrastructure: available on a Planet or Moon where the Corporation has Contract Access
- Manufacture Unit: available where the Corporation controls or leases a Shipyard
- Transfer Resources: available to a contracted Empire, an affiliated Empire or an owned Faith
- Offer Contract: available to any Empire or Corporation
- Accept Contract: available if the other party also submits acceptance this Turn
- Cancel Contract: available on any current Contract
- Affiliate publicly: available once; once used, the Affiliation is permanent

## Faith Actions

- Establish Presence: available on a Planet with Population and no existing Presence by that Faith; costs 5 Favour
- Preach: available on a Planet with Faith Presence; increases local Presence strength by 1, up to 3
- Support Stability: available on a Planet with Faith Presence; increases Stability by 1
- Incite Unrest: available on a Planet with Faith Presence; reduces Stability by 1
- Bless Harvest: available on a Planet with Faith Presence; grants +3 Credits or +2 Metals during this Tick
- Request Donation: available on a Planet with Faith Presence; converts 3 Population worth of local support into 6 Favour for the Faith and -1 Stability for the Controller
- Transfer Favour: available only to another owned Institution
- Affiliate publicly: available once; once used, the Affiliation is permanent

# Combat and Control

- Military combat is deterministic.
- Each Military Unit has 3 Attack and 3 Defense.
- Civilian Units and Freighter Units have 0 Attack and 1 Defense.
- Fortress adds 3 Defense to the location.
- A defending Empire wins ties.
- Invading a Planet transfers control only if the attacker wins combat and has at least 1 surviving Military Unit.
- Bombardment destroys 1 target Infrastructure on a successful attack and reduces local Stability by 1.
- A newly Invaded Planet cannot be Taxed until the next Tick.

# Population, Stability and Presence

- Colonized Planets start at 8 Population unless they are Home Planets, which start at 12.
- Population grows by 1 during each Tick on a Planet with Stability 7 or higher and spare Housing capacity.
- Each Administration adds Housing capacity for 4 Population.
- Stability below 4 applies -2 Credits to Planet collection.
- Stability at 0 causes Revolt: the Planet produces no Resources during that Tick and cannot Grant Contract Access.
- Faith Presence strength ranges from 1 to 3 and is tracked separately for each Faith.

# Scoring

Total Score is the sum of all Institution scoring across the game.

## Empire scoring

- +1 per controlled Planet each Tick
- +1 per 2 controlled Moons each Tick
- +1 per 5 Population each Tick
- +2 per active Treaty each Tick, maximum 6
- +3 for each successful invasion
- -2 for each Planet lost to invasion

## Corporation scoring

- +2 per fulfilled Contract
- +1 per active Extraction Infrastructure each Tick
- +1 per 20 stored Credits, maximum 8 each Tick
- +2 each Tick if the Corporation has Contracts with 3 different Empires

## Faith scoring

- +2 per 3 Planets with Presence each Tick
- +1 per Planet with Presence strength 3 each Tick
- +3 each Tick if the Faith has Presence on Planets controlled by 3 different Empires
- +2 each time a Planet with Faith Presence enters Revolt

## End-game ranking

- Highest Total Score wins.
- Ties are broken by higher Empire scoring contribution.
- Remaining ties are broken by higher Population under Empire control.

# Institution Creation and Anonymous Ownership

## Corporation creation

An Empire may create a Corporation once it controls at least 2 Planets. The Empire chooses:

- Corporation name
- public legal identity
- starting charter from `Extraction`, `Logistics`, or `Industry`

The new Corporation enters the game as a public Institution with a public name and public assets, but its Owner is hidden. The game UI presents it as `Unknown Owner` until the controlling player declares an Affiliation.

## Faith creation

An Empire may create a Faith once it controls at least 3 total Planets and Moons. The Empire chooses:

- Faith name
- public creed name
- Doctrine

The new Faith enters the game as a public Institution with a public identity and visible Presence, but its Owner is hidden. The game UI presents it as `Unknown Patron` until the controlling player declares an Affiliation.

## Affiliation rules

- An Affiliation is voluntary and public.
- Declaring an Affiliation permanently reveals the link between an Empire and one owned Corporation or Faith.
- A player may leave a Corporation or Faith hidden for the entire game.
- The game never reveals hidden ownership through logs, scoring, diplomacy, combat or other mechanics.

# Contracts and Treaties

## Contract

A Contract is a formal economic agreement. The default MVP supports 3 Contract types:

- Harvest Contract: permits Asteroid Harvest on named territory for 3 Ticks
- Build Contract: permits Infrastructure construction on one named Planet or Moon for 3 Ticks
- Transport Contract: pays 15 Credits when one Freighter completes one named delivery route

Contracts are public agreements between Institutions. A hidden Corporation may sign public Contracts without revealing its Owner.

## Treaty

A Treaty is a formal diplomatic agreement between Empires. The default MVP supports 3 Treaty types:

- Non-Aggression Pact: blocks Attack, Bombard and Invade between the signatories for 5 Ticks
- Trade Accord: both Empires gain +6 Credits during collection for 5 Ticks
- Access Treaty: both Empires may transfer Resources directly for 5 Ticks

Treaties are always public.

# Game Views

The MVP should include these Views:

- Lobby View: players, ready state, Ruleset summary, game start
- Strategic Overview View: Institution summaries, current Resources, Action counts, current Tick, pending readiness
- Map View: Star System layout, ownership, Unit positions, Faith Presence, Contracts and Treaties
- Empire View: controlled territory, Population, Stability, Infrastructure, Units and available Empire Actions
- Corporation View: Contracts, leased access, Units, Infrastructure, treasury and available Corporation Actions
- Faith View: Presence map, Doctrine, Favour, Influence targets and available Faith Actions
- Planet View: Controller, Population, Stability, Slots, Infrastructure, local Units, Faith Presence and local Actions
- Moon View: Controller, Slots, Infrastructure, local Units and local Actions
- Asteroid View: claim status, deposit type, remaining yield and Harvest options
- Diplomacy View: public Treaties, public Affiliation declarations, Contract proposals and outbound offers
- Event Log View: resolved Tick outcomes in causal order
- Score View: current Total Score breakdown by Institution type
- Ruleset View: enabled mechanics, action costs, resolution order and victory rules
- Messages View: direct player-to-player communication

# MVP Content Boundaries

The MVP should not include:

- espionage systems that reveal hidden ownership
- tactical battle maps
- more than 3 Institution types
- direct Faith combat Units
- more than 1 Star System in the default Ruleset
- random combat resolution

# Glossary

- Action: A command submitted by an Institution during a Turn.
- Administration: An Infrastructure type that increases Housing capacity and enables growth support.
- Affiliation: A public declaration linking a hidden Institution to its Empire.
- Asteroid: An extraction Object with finite yield.
- Contract: A formal economic agreement between Institutions.
- Controller: The Institution that currently governs or operates an Object.
- Corporation: An economic Institution focused on extraction, logistics and services.
- Credits: The base economic Resource.
- Doctrine: The chosen operating model of a Faith.
- Empire: The public territorial and military Institution.
- Energy: A Resource used for logistics, advanced Infrastructure and some Faith Actions.
- Event Log: The ordered record of resolved Tick outcomes.
- Faith: An ideological Institution focused on Presence, pressure and support.
- Favour: The Faith-only Resource.
- Home Planet: The starting Planet of an Empire.
- Infrastructure: A constructed Object that modifies production, defense, logistics or reach.
- Institution: A playable entity with its own Actions and Resources.
- Moon: A secondary territorial Object attached to a Planet.
- Orbit: A movement band around the Star.
- Owner: The player who controls an Institution.
- Planet: The primary territorial Object with Population and Stability.
- Population: The number of inhabitants on a Planet.
- Presence: A Faith's ideological foothold on a Planet.
- Reform: The Empire Action that restores Stability.
- Resource: A spendable currency or material pool.
- Ruleset: The data-driven rule definition of a game.
- Stability: A Planet governance value from 0 to 10.
- Star: The central map Object of the System.
- System: The complete playable map centered on one Star.
- Tick: The server-resolved step that advances the game state.
- Total Score: The sum of a player's scoring from all controlled or affiliated Institutions.
- Treaty: A formal diplomatic agreement between Empires.
- Turn: The player submission period before a Tick resolves.
- Unit: A mobile operational Object belonging to an Empire or Corporation.
- View: A distinct UI surface for reading state or submitting Actions.
