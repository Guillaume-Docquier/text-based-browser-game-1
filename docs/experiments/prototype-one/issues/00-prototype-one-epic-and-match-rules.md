# Heirs of Sol Prototype 1 · Epic

Agent: Codex gpt-6.2-astra high

## Purpose and match rules

Heirs of Sol Prototype 1 tests whether extracting, refining, and transporting resources makes an interesting strategy game. Between 1 and 16 players work toward one Dyson swarm at the Sun while competing for individual contribution points. A solo player can run the entire supply chain. In multiplayer, one player can mine metal, a second can refine it, and a third can deliver the alloy. Each player earns contribution points for their part when the material reaches the Sun. Credits are the currency each player spends on orders. A player’s score is their total contribution points from production, refining, and transport.

The existing shell supports browsing, creating, joining, leaving, starting, and entering games. It supplies procedural galaxy generation, galaxy and system maps, timed simultaneous turns, reversible readiness, and turn processing. Players plan independently. A turn resolves when time expires or everyone locks in.

The swarm target scales with the number of players. Reaching it ends the match on that turn and players rank by total contribution points. Turn 100 is the last chance to complete the swarm. If it remains unfinished after that turn resolves, everyone loses.

## Galaxy and starting positions

Keep the approximate scale of 700 stars and 3,000 planets. Include a recognizable Sol system with the Sun and the familiar Solar System planets. Every star and planet has unique coordinates. Their locations and coordinates are public from the start.

Each player starts with one owned home planet in a different system from every other player’s home. It has room for a command center on the center hex, one shipyard, and one trade center. One transport starts stationed there, available to scout. Each player receives a personal starting credit balance.

Keep biome, size, and area, with ranges tuned for this prototype. Replace the single metal attribute with two distinct values. **Metal production** is the amount one mine can extract per turn. **Remaining deposit** is the finite amount still underground. Mining reduces it permanently. Every planet in any player’s home system and every planet in Sol has zero metal production and zero remaining metal deposit. Only planets outside those systems use the biome-specific deposit rolls in [increment 03](03-generate-planetary-metal-deposits.md). Distance from the Sun has no effect on those rolls. Remove fertility, fuel, energy, and maximum population from planet generation, stored planet data, and player-facing views.

## Maps, vision, and scouting

Players use the galaxy view for interstellar distances, the star system view for local distances, and a dedicated full planet view for surface hexes, buildings, and planet information. Selecting a planet opens this view in the main play area. Reloading returns to the same planet. Moving between the two map scales should feel fluid. Each owned planet provides scan coverage within a radius of 3 light-years (LY) from its center. Every ship type has a scan radius of 1.5 LY from its current position. Apply the same visibility rules to maps, lists, inspectors, and the information supplied to each player.

| Information                                                                             | In current vision                                              | Outside current vision                                                    |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Star and planet locations and coordinates                                               | Public                                                         | Public                                                                    |
| Planet ownership, biome, size, area, metal production, remaining deposit, and buildings | Show current information                                       | Show the last observation if one exists. Refresh it when vision returns.  |
| Ships, cargo, and planetary stockpile contents                                          | Show current contents, including contributors on visible items | Hide them. Passing or previously visible ships and items leave no record. |
| The Sun, ships stationed there, and its stockpile                                       | Public                                                         | Public                                                                    |

A moving ship surveys the full segment it travels each turn. If a planet comes within 1.5 LY of that segment and the ship finishes outside scan range, the player still gets an observation of that planet’s resolved attributes. Only the final state is visible. A flyby does not preserve a record of ships, cargo, or stockpile contents along the way.

## Orders and simultaneous resolution

Players give orders through the game interface. Every order has a private preview that the player can distinguish from resolved state. Show the exact build hex, claim target, ship and movement destination, individual transfer items, or refinery inputs and output pile as applicable. Other players cannot see planned orders, even when they can see the ship or building involved.

Every action uses the state at the start of its turn. A player can target only actors, items, locations, and funds already eligible at turn start. Effects appear when the turn resolves and can first enable another action on the following turn. For example, a ship built or arriving on turn N can act there on N+1, income earned on N can fund orders on N+1, and metal mined or delivered into drop-off on N can be selected for refining on N+1. Private previews check the player’s other pending orders and prevent contradictory commitments, including selecting the same item for two orders.

A player can cancel any order they submitted during the current planning turn until that turn starts resolving, whether resolution begins at the deadline or because everyone locked in. Canceling removes that order and its private preview, immediately refunds any credits charged or releases the full amount reserved, and frees the ship or building for another order in the same turn. Other orders stay in place. Only orders still submitted when resolution begins can take effect. For example, canceling a planned move leaves the ship at its origin with its full travel budget available. Once the ship departs, the trip cannot be recalled.

Each ship can take one action per turn, independently of other ships. Buildings act through their own capabilities. A command center and two shipyards can all work in the same turn. Resolve competing claims and competing pickups by different players randomly, with no advantage for earlier submission. A refinery draws only from its owner’s private drop-off pile, where the owner’s order previews prevent competing uses of an item.

## Ships, travel, and colonization

| Ship type              | Cargo slots | Empty speed | Role                                                                                                       |
| ---------------------- | ----------: | ----------- | ---------------------------------------------------------------------------------------------------------- |
| Scout                  |           1 | Fast        | Light survey ship. Loading its single slot sharply reduces its speed.                                      |
| Transport (cargo ship) |           4 | Medium      | Reusable starting ship for hauling and scouting. It has greater empty mass and more thrust than the scout. |
| Colony ship            |           0 | Medium      | Travels empty to an unowned planet and can be consumed to establish a colony.                              |

Each ship type defines thrust, empty ship mass, and cargo space in slots. All ships use `speed = k × √(thrust / total mass)` with one shared speed scale k. Total mass is the empty ship mass plus the mass of all items aboard. A loaded ship travels more slowly than the same ship empty. One item makes up a much larger fraction of the scout’s empty mass than of the transport’s. Tune the masses so the same item causes a much larger percentage drop from empty speed on the scout. Movement previews and turn resolution use the same speed for the departure load.

Each ship moves directly from any planet or star to any other planet or star, including across systems. Range is unlimited. Travel time in turns is `ceil(distance / speed)`, with distance in light-years (LY) and speed in LY per turn. The ship moves when the departure turn resolves, and that turn counts. A 1 LY trip at 1 LY per turn submitted on turn N arrives at the end of N. The ship can act at its destination on N+1. Travel costs one credit per LY, paid in full at departure.

Players can select a ship, choose **Move**, and enter destination coordinates. They can also select a body, choose **Move here**, and pick a ship. Both paths preview the destination, travel time, and cost. A trip can span several turns. Once underway, the ship follows its chosen course through arrival and stays at the destination until its owner gives another order. For one ship, unloading, loading a return cargo, and departing take three separate turns.

Claiming is a separate action for a colony ship already stationed at an unowned planet. A successful claim consumes the ship, assigns one owner, and places a command center on the center hex. For competing claims, choose one winner at random. Only the winning ship is consumed. The others stay at the planet.

## Buildings and credits

Planet area determines the number of usable surface hexes. Arrange hexes from the center outward in concentric rings with a fixed traversal order, including any partial outer ring. Empty and occupied hexes keep their positions on reload. Persist each building in the database with its type, planet, and hex. Each building type has matching hex art. Each hex holds at most one building. Placement is permanent for the match, including an exhausted mine. A planet has at most one command center. It occupies a normal hex and players cannot construct another. Constructing buildings and building ships cost credits from the owner’s global balance, which can be spent across all colonies. Metal and alloy remain local physical items in the swarm supply chain.

| Building       | Capability                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command center | Constructs one building at a time. The player selects the building and hex. Construction requires ownership of the planet at turn start.                                                                                                                                                                                                                                                                    |
| Trade center   | Produces credits for the owner’s global balance. The home trade center supplies initial income.                                                                                                                                                                                                                                                                                                             |
| Shipyard       | Builds one ship at a time at its planet. Each additional yard adds independent capacity, including while the command center is constructing a building.                                                                                                                                                                                                                                                     |
| Mine           | If built by turn start, automatically extracts at the planet’s production rate up to the remaining deposit. All mines on a planet draw from that deposit. The owner sets each mine’s output to private drop-off (default) or public pickup. The setting persists across turns and uses no action.                                                                                                           |
| Refinery       | The owner may give each refinery one order per turn. Select exactly four distinct metals from the private drop-off pile at turn start and choose an output pile. Drop-off is the default and pickup is the alternative. Resolution consumes the selected inputs and produces one alloy, first available for orders on the next turn. Two refineries can each produce one alloy using eight distinct metals. |

The intended production sequence at a new colony is to claim on one turn, build a mine on the next, and extract the first metal on the third. Additional copies of constructible buildings occupy additional hexes and increase output or capacity.

## Resources, stockpiles, and handoffs

Every metal and alloy is an individual item. Anyone who can see it can inspect its production, refining, and transport history. Two items of the same material on the same planet may have different contributors. Players receive contribution points only when the item reaches the Sun.

Every colony has a private **drop-off** pile and a public **pickup** pile. Anyone in scan range can inspect both piles and the contribution history of each item.

| Colony action                         | Planet owner            | Visitor            |
| ------------------------------------- | ----------------------- | ------------------ |
| Load a stationed ship                 | From either pile        | From pickup only   |
| Unload a stationed ship               | Into either pile        | Into drop-off only |
| Transfer items directly between piles | Drop-off to pickup only | No direct transfer |

Each mine automatically places new metal directly into its configured pile. Changing that setting affects future output only. Each refinery order takes inputs from drop-off and specifies the pile for that batch of alloy. Items produced, unloaded, or released on turn N become eligible for another order on N+1. Canceling a pending release lets the owner use those items in another plan while the turn is open.

A load action transfers the exact items selected, up to the ship’s free capacity. An unload action can transfer any selected items aboard. One metal and one alloy each use one cargo slot. When several ships request the same item, resolve the conflict randomly for that item. Other uncontested items remain eligible to load.

The Sun has one public, drop-off-only stockpile. Use the ordinary unload action to deliver there. Delivered items remain individually inspectable and cannot be picked up again.

## Swarm progress, contribution points, and standings

When an item enters the Sun’s stockpile, update shared progress and public player scores immediately. Players can deliver raw metal or refine it first. Four raw metals occupy four slots and yield four progress. One alloy occupies one slot and yields six progress. The alloy retains its refinery owner and the producers and prior hauling histories of all four inputs.

| Delivered item | Swarm progress | Production contribution points     | Refining contribution points | Transport contribution points to divide |
| -------------- | -------------: | ---------------------------------- | ---------------------------- | --------------------------------------: |
| One metal      |              1 | 1 to its producer                  | 0                            |                                       1 |
| One alloy      |              6 | 1 per source metal to its producer | 2 to its refinery owner      |                                       6 |

When a ship travels X LY, each item aboard records X LY under that ship’s owner. Count the actual distance traveled, including detours and repeated legs. Refining preserves the four source metals and their individual histories as components of the alloy. The new alloy starts its own haul history at zero. Subsequent travel adds distance to the alloy’s own history only.

Score each delivered item separately. For a raw metal, each hauler’s weight is their recorded LY on that metal. For an alloy, each hauler’s weight is the sum of their recorded LY on its four component metals plus four times their recorded LY on the alloy itself. The multiplier is the number of component metals and applies at delivery. Divide the item’s transport contribution points in proportion to those weights.

For example, two producers supply two metals each. Alice carries all four metals 1 LY. Each metal records 1 LY for Alice. After refining, Bob carries the alloy 2 LY to the Sun. The alloy records 2 LY for Bob. On delivery, Alice’s weight is 1 + 1 + 1 + 1 = 4, and Bob’s weight is 4 × 2 = 8. Of the alloy’s 6 transport contribution points, Alice earns 2 and Bob earns 4. The swarm gains 6 progress, each producer earns 2 production contribution points, and the refiner earns 2 refining contribution points.

Count every valid Sun delivery in the finishing turn and award all its contribution points for production, refining, and transport before determining standings. Progress can exceed the target, including on turn 100. For example, 8 progress delivered at 98 of 100 gives a final total of 106. Rank players by total contribution points across all three roles. Equal totals share a rank and occupy that many places. All players tied for first win, so two tied winners are followed by third place.

## Playable increments

The 28 sub-issues give the suggested implementation order. The full planet view is [step 03a](03a-open-planets-in-a-full-planet-view.md), immediately before the buildings system in [step 04](04-persist-buildings-and-display-them-on-stable-planet-hexes.md). Scout ships are [step 12a](12a-add-scout-ships.md), immediately after [shipyards](12-build-ships-at-shipyards.md). Each adds one system to the game people can already play. Start with home worlds. As each starting building becomes available, place it on home worlds in that same increment. Give players their starting transport as soon as transports exist, and their starting shipyard as soon as shipyards exist.

Ship each action with its private preview, cost where applicable, resolution, and visible outcome. Give each shared behavior one owner across the game. Planetary unloading and Sun delivery use the same transfer action, with progress and scoring applied when the Sun receives the item.

## Outside Prototype 1

Science, trade actions, messages, action cards and their effects, workers, Sun processing, final assembly, ship customization, fleet grouping, automatic return trips, repeating routes, recall, building upgrades, demolition, and tie-breaking bonuses are outside scope. Favorites, tags, search and filter enhancements, historical graphs, sortable scoring breakdowns, and turn outcome logs can wait. Favoring deposits farther from the Sun is a future design direction.
