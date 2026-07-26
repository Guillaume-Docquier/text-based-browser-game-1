# Use shared turn windows for independent play

## Status

Planned

## Context

The game should reward strategic decisions rather than constant availability. Players need to be able to play a turn on their own schedule without waiting for another player to respond, accept an offer, or acknowledge an action.

At the same time, every empire acts in the same shared galaxy. The game needs a consistent moment when all player decisions and the empire simulation take effect together.

## Decision

Each turn has a shared order window. Players submit agendas and directives against the last resolved state, then the game resolves all empires at a scheduled time.

A player may mark their empire ready. Readiness is reversible while the order window remains open. If every empire is ready, the game begins resolving immediately.

Orders are private during the order window. Players see only the last resolved state and the information their empire can observe through fog of war. Other empires' agendas and directives are not revealed.

An empire that submits no orders receives no default agendas or directives. Its ongoing simulation still proceeds: existing investments and systems, such as population growth and industry, continue to operate.

Every player must be able to submit a complete set of actions independently. An action must not require another player to accept, acknowledge, or respond before it can function. The system resolves valid interactions according to game rules at turn resolution.

The ongoing simulation is a core part of the game, but leaving it entirely unattended must not be an optimal strategy. Agendas and directives should be valuable enough that players normally want to play their turns, while an empire remains viable and the game keeps moving when a player is absent.

## Consequences

Players can complete a turn in one session and do not need to coordinate their availability with other players. Unanimous readiness can shorten a quiet turn without making any player permanently commit before resolution.

Ongoing simulation means the game does not need to delay a turn when a player submits no orders. Missing a turn is a manageable setback rather than an immediate collapse of that empire, while active play remains the stronger choice.

Private orders and fog-of-war-limited information preserve simultaneous decision-making and prevent players from reacting to orders already submitted in the same window. This makes intelligence, anticipation, and long-term planning valuable.

The game must provide deterministic resolution rules for competing valid orders and clear feedback after resolution. Those rules, along with the detailed visibility of resolved events, are separate design work.
