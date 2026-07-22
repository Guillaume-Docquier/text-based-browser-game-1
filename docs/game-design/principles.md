# Design Principles

This document describes design problems and their solutions. These established principles will guide game design as they'll become design constraints.

This is the equivalent of ADRs, for the game design space.

## Space Setting

Problem: I like space games

Solution: It'll be a space game

## Turn Based & Independant Play

Problem: Real-time persistent games encourage 24/7 presence and reward players that can be the most active.

Solution: The game is turn based and players must be able to play their turn at any time with a single play window.

Explanation: There are no actions requiring two players to interact / coordinate. Thus, the time at which a player logs in to play has no impact on their decisions. A single login is all it takes to play, as there is no back and forth required by player interactions. This does not mean that there is no player interaction, only that the interaction doesn't happen during a single turn.

## Auto-accepted Trade & Contracts

Problem: Given Turn Based & Independent Play, we still want interactions such as trade and contracts.

Solution: Players offering trades cannot decide who they trade with. They offer the trading (or contract) terms which can then be accepted by anyone. This necessarily happens over 3 turns or more (1 turn to offer, 1+ turns to accept, 1 turn to observe the accepted trade)

Explanation: We could allow the players to target who they offer the trade to, but this indirectly entails timely player coordination... not really. It's just a choice that plays nicely with other design choices.
