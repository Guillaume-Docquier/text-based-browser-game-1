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
The game offers asymmetric elements and partially hidden identities that make diplomacy highly strategic.

Finally, players have total control of game balance. Every single number can be tweaked if players wish and published as presets.  
This allows the community to create alternative game modes or patch imbalanced strategies.

# Product Design

## Player Experience and Game POV

<!--- Who is the player? What is the setting? What is the fantasy the game grants the player? --->
<!--- What emotions do you want the player to feel? What keeps the player engaged for the duration of their play? --->

## Visual Style

<!--- What is the “look and feel” of the game? How does this support the desired player's experience? --->
<!--- What concept art or reference art can you show to give the feel of the game? --->

## Game World Fiction

<!--- Briefly describe the game world and any narrative in player-relevant terms (as presented to the player). --->

## Monetization

<!--- How will the game make money? Premium purchase? F2P? How do you justify this within the design? --->

## Platforms, Technology and Scope

<!--- PC or mobile? Table or phone? 2D or 3D? Unity or Javascript? How long to make, and how big a team? --->
<!--- How long to first-playable? How long to complete the game? Major risks? --->

# Game Systems Design

## Core Loops

<!--- How do game objects and the player's actions form loops? Why is this engaging? How does this support player goals? --->
<!--- What emergent results do you expect/hope to see? If F2P, where are the monetization points? --->

## Objectives and Progression

<!--- How does the player move through the game, literally and figuratively, from tutorial to end? --->
<!--- What are their short-term and long-term goals (explicit or implicit)? --->
<!--- How do these support the game concept, style, and player-fantasy? --->

## Game Systems

<!--- What systems are needed to make this game? Which ones are internal (simulation, etc.) and which does the player interact with? --->

## Interactivity

<!--- How are different kinds of interactivity used? (Action/Feedback, ST Cog, LT Cog, Emotional, Social, Cultural) --->
<!--- What is the player doing moment-by-moment? How does the player move through the world? --->
<!--- How does physics/combat/etc. work? A clear, professional-looking sketch of the primary game UX is helpful. --->

# Initial ideas

## Dimensions

Empire:

- Enables economic activities
- Enables population & territory growth
- Drives laws & doctrines

Corporations:

- Exploit resources
- Develop technologies
- Build infrastructure

Religions:

- Influence politics
- Gather intel
- Sabotage & Smuggling

## Turns

Game plays with long ticks / turns (maybe 1-3 turns a day)
Real time is fun, but too addictive and makes you check the game non stop

## Special Turns

Every X turns, there is a special turn, where all entities (empires, corporations and religions) vote on certain things that affect the whole empire.

It could be things like:

- bonus to certain exploitations
- bonus tech gains
- disallow certain actions (like wars, or colonization)
- choice of free tech / perk

## Actions

Each player has a clear number of actions to submit.
Something like:

- Each owned planet: 2 planet action points
- Each owned moon: 1 moon action point
- Each corporation: 1 action point per unit
- Each religion: 1 action point per planet

Action points can be distributed however you want within their pools (empire/corpo/religion) as long as they don't conflict.
For example:

- You could spend all your empire actions on a single planet
- You could have a corporation unit move and harvest, but it cannot move twice

Some actions might cost multiple action points. It is possible that a unit has to idle.
It is possible to save action points for future turns.
Some actions might also take multiple turns to complete or cost additional resources.

## Resource Gains

Empire takes a cut from active corporation contracts (even when the corp is not harvesting)
Corporations earn money/resources based on their actions (harvest)
Religions earn favour based on their level of influence

## Score Gains

Empire scores based on planet owned and total population
Corporations score based on short term contracts
Religions score based on long term hidden agendas

## Gameplay loop

Open the game
Clearly see all your entities and the number of actions left to submit for each
Browse event logs for the previous turn(s) to understand what other players are doing
Evaluate if the current strategy still makes sense
Send messages and offers to other players
Execute via orders
Submit ready

# UI inspiration

## Galaxy view

| wireframe                                                                                 | hifi                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ![Image](https://github.com/user-attachments/assets/6a56e815-f439-4fdf-a811-951069e6badc) | <img width="1024" height="1536" alt="Image" src="https://github.com/user-attachments/assets/1ad4eec5-cb0b-476f-98cf-1ea0f0d610a0" /> |

## Planet overview view

| wireframe                                                                                 | hifi                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ![Image](https://github.com/user-attachments/assets/79a424fe-abba-46c1-bff4-0188af453310) | <img width="1024" height="1536" alt="Image" src="https://github.com/user-attachments/assets/5475ab03-4ce6-4327-b57b-327e7c64e8d2" /> |
