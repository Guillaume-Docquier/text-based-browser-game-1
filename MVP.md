# MVP

The scope for the MVP

The minimum viable product will implement the core game mechanics and basic UI features:

- No responsive UI
- Core game mechanics, strict minimum to showcase the game's ambiance and vision
- Easily extensible game mechanics architecture

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
