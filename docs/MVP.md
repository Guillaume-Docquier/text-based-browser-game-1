# MVP - Cosmic Empires

The scope for the MVP

The minimum viable product will implement the core game mechanics and basic UI features:

- No responsive UI
- Core game mechanics, strict minimum to showcase the game's ambiance and vision
- Easily extensible game mechanics architecture
- Fully customizable ruleset

# High Level Concept

## Concept

Cosmic Empires is a turn-based space strategy game where every decision shapes your rise to power.  
Build your empire over time through military conquest, economic dominance, technological innovation or cultural influence.  
Multiple paths lead to victory.

Plan long-term, forge strategic alliances and outmaneuver rival players in a dynamic galaxy.  
Whether you prefer commanding fleets, mastering trade networks, advancing cutting-edge research or spreading your influence across civilizations,  
Cosmic Empires rewards smart strategy and precise timing.

In Cosmic Empires, strategy isn't just about reacting, it's about anticipating and orchestrating.  
Long-term strategy matters more than short-term tactics.

## Genre

Multiplayer sci-fi 4X strategy game focused on long-term planning, diplomacy and asymmetric power systems.

The game is a "computer-aided board game" (a board game that you play on a computer).

## Target Audience

<!--- Motivations and relevant interests; potentially age, gender, etc.; and the desired ESRB rating for the game. --->

The game targets gamers or ages 20+ that have real-life commitments but are looking for long strategic games that can be played in a group.  
They would probably enjoy real-time persistent games if they could spend the time.

Fans of games like Astroempires, Stellaris, Diplomacy and Axis & Allies should enjoy this game.

## Unique Selling Points

<!--- Critically important. What makes your game stand out? How is it different from all other games? --->

Most space strategy games feature military win conditions. Cosmic Empires offers a game loop that isn't reduced to having the strongest army.

In Cosmic Empires, you play as multiple distinct entities: Empire, Corporations and Churches.
Each entity is distinct but will contribute to your Empire score at the end of the game. The Empire has your name on it, but Corporations and Churches are anonymous unless you opt into affiliating them to your Empire.  
This creates interesting diplomatic relations because you do not always know who you are partnering with.  
Empires, Corporations and Churches all have different playstyles, with unique actions and specializations.  
War is designed to not trivialize the game. One cannot annihilate another player without suffering an opportunity cost that would cost themselves the game.  
This makes peace plays possible. The use of force will only be beneficial in certain situations if planned correctly, like all the other dimensions of the game.

Finally, players have total control of game balance. Every single number can be tweaked if players wish and published as presets.  
This allows the community to create alternative game modes or patch imbalanced strategies.

# Product Design

## Player Experience and Game POV

<!--- Who is the player? What is the setting? What is the fantasy the game grants the player? --->
<!--- What emotions do you want the player to feel? What keeps the player engaged for the duration of their play? --->

The player plays as an Empire. The Empire owns planets and is responsible for the legislation on their territory.  
An Empire might open their borders for economic activities, or be a warmonger that can provide protection in exchange for certain services, allow or disallow criminality, etc.

The player will also play, if they so choose, as one or more Corporations and Churches. Corporations and churches operate on different planes and scope as the Empire.  
Corporations are more micro and highly specialized. You might found a mining company, or a tech lab, or defense contractor.  
Churches are more covert and macro. A church might try to influence certain empire choices, sabotage or enable certain Corporation activities through ideology, etc.

This diversity aims at enabling all sorts of plays. If a player wants to be an Empire mastermind, they can focus on playing as Empire. Or they could choose to found many Corporations and offer services to all Empires, to their benefit.  
Players should feel like they are executing a large-scale plan. They should be thinking multiple turns at a time and anticipate which actions they'll take to achieve long-term objectives.

Diplomacy should be a calculated risk. Make the right deals, and you'll put yourself in the top spot, or make a few bad deals with your rivals and they'll gain the advantage on you.  
Without having to engage with the game all day to be sure to react, players should look forward the turn to end to see what others have done and how their plan holds up.

## Visual Style

<!--- What is the “look and feel” of the game? How does this support the desired player's experience? --->
<!--- What concept art or reference art can you show to give the feel of the game? --->

This is a space game, but also a browser text game. While there will be visual elements, the fantasy should take place in the player's head.  
The game will have a polished, high-tech sci-fi look but might not provide images for every single thing.

The visuals (and lore) will be inspired by books like Dune and The Expanse and games like Homeworld 2.

### Ships

| The Expanse Roccinante                                                | Homeworld 2 Corvettes                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ![The Expanse Roccinante](.github/images/inspiration-the-expanse.png) | ![Homeworld 2 Corvettes](.github/images/inspiration-homeworld-2-ships.png) |

### Maps

| Dune Board Game Map                                         | Homeworld 2 Tactical Map                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Dune Board Game Map](.github/images/inspiration-dune.png) | ![Homeworld 2 Corvettes](.github/images/inspiration-homeworld-2-map.png) |

### AI Generated UI

| AI Generated Solar System UI                                                    | AI Generated Planet UI                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| ![AI Generated Solar System UI](.github/images/mockup-ai-solar-system-view.png) | ![AI Generated Planet UI](.github/images/mockup-ai-planet-view.png) |

## Game World Fiction

<!--- Briefly describe the game world and any narrative in player-relevant terms (as presented to the player). --->

Humanity has achieved space colonization within the solar system and is not far off from being able to colonize other systems.  
Different factions emerged throughout the solar system, each competing for the rise of their ideologies and lifestyle.  
While not at war, the factions' relations have been tense at times and small conflicts have happened in the past.

Will you lead a mercantile empire, a progressive technocratic society or an authoritarian warmonger faction? The choice is up to you.

## Monetization

<!--- How will the game make money? Premium purchase? F2P? How do you justify this within the design? --->

The game will be entirely free to play with no pay to win mechanics.  
Players will be encouraged to support the development of the game via QoL benefits outside the games, such as being able to customize game settings or participate in more games at the same time.  
There might be cosmetics as well, such as profile banners or badges, etc.

The goal won't be to make money, but rather just pay for the infrastructure, which should be relatively cheap to start with (expected 5-10 CAD per month).

## Platforms, Technology and Scope

<!--- PC or mobile? Table or phone? 2D or 3D? Unity or Javascript? How long to make, and how big a team? --->
<!--- How long to first-playable? How long to complete the game? Major risks? --->

The game will be a browser text game written in javascript. Mobile will be supported through responsive design, not an app.  
It will take about 3 months to create an MVP, and 9 months until the open beta.  
The expected team will be 1 developer.

# Game Systems Design

## Core Loops

<!--- How do game objects and the player's actions form loops? Why is this engaging? How does this support player goals? --->
<!--- What emergent results do you expect/hope to see? If F2P, where are the monetization points? --->

THE core loop is the game turns. During a turn, players will have a budget of actions they can take.  
Each unit, building, planet, etc. will offer a set of actions that can be taken, and the player will have to choose the best course of action for their strategy.  
When all actions are chosen, player can choose to Ready themselves and the turn will progress after the time runs out or if all players are Ready.

Players will be exchanging messages, drafting contracts and treaties, building infrastructure, positioning units, doing espionage, etc.  
There will be synergies that encourage players to specialize, but also to encourage them to make deals with other players.  
It should be hard to specialize in many aspects of the game, but having access to multiple highly specialized products will yield high rewards.

We hope to see different metas emerge with players gaming the core ruleset and discuss different strategies. It would be nice to see players use game mechanics in a way that they weren't designed for, as long as their use is clever and invested in a strategy.  
We also hope to see players design their own game modes through custom rulesets, playing with very fast or slow turns, with fewer or more players.  
We hope that the game will offer a flexible enough sandbox to have fun in different ways.

## Objectives and Progression

<!--- How does the player move through the game, literally and figuratively, from tutorial to end? --->
<!--- What are their short-term and long-term goals (explicit or implicit)? --->
<!--- How do these support the game concept, style, and player-fantasy? --->

There will be no tutorial, but there will be extensive documentation of the game mechanics.  
The best way for players to learn the game will be to play a game with the "beginner ruleset" with new players.  
This ruleset will be designed to offer a forgiving setting where misplays don't have devastating consequences and where you can explore multiple game mechanics easily.  
It might also disable certain mechanics altogether, as to not overwhelm newcomers.

In terms of progression, there will be no real meta-progression. To its core, you play a game from start to end, then start another one.  
If the game has a large enough playerbase, we will probably host tournaments, or leagues, with players participating in a variety of games and accumulating score to compete for the top spot.

Within the game itself, the long-term goals will be to decide on a strategy to go for to win the game and adjust depending on what other players do.  
The short-term goals will be to optimize every step of the way to achieve their strategy. We hope that certain turns might not score a lot of points but will be necessary setup to score higher points later, rewarding long term planning.

These support the philosophy of the game being strategic, not tactical.  
Games will reward players who can execute a vision and not be distracted by short-term gains.  
Leagues will reward being able to play different strategies on different rulesets.

## Game Systems

<!--- What systems are needed to make this game? Which ones are internal (simulation, etc.) and which does the player interact with? --->

We will need:

- Highly modular, data-driven tick processing pipeline with reasonable performance to support a variety of rulesets but also to be able to add game mechanics.
- Data-driven UI to correctly display ui sections and actions that are available in the game's ruleset.
- Real-time communication for notifications (chat messages, treaty & contract offers, etc).
- Database persistence.
- Authoritative server with solid validation to prevent cheating and bugs.
- Authentication to identify players and control their access.

In terms of game mechanics, we will need:

- Empire
- Corporations
- Churches
- Alliances
- Chat
- Movement
- Tech trees & other progression systems
- Scoring system
- Resources and currencies
- Trade system

## Interactivity

<!--- How are different kinds of interactivity used? (Action/Feedback, ST Cog, LT Cog, Emotional, Social, Cultural) --->
<!--- What is the player doing moment-by-moment? How does the player move through the world? --->
<!--- How does physics/combat/etc. work? A clear, professional-looking sketch of the primary game UX is helpful. --->

The game is a tick-based simulation for a text game. The players see the current state, lock in actions and see the resolution when the turn ends.  
They interact with other players through in game messages and notifications.  
Everything will be deterministic, but players will not have access to all information (such as other players' chosen actions).  
The UI is there to make the game feel nice and set the fantasy and tone, but is accessory. True fans would still enjoy the game if it was a big spreadsheet.
