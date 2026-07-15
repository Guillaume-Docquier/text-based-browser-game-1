# Glossary

These are terms and their meaning in the context of this app.

| Term            | Description                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User            | An entity that owns an account, most likely a human. Each user is only allowed to have 1 account.                                                                                                  |
| Account         | All the data that identifies and is tied to a user in the system. Users are referenced by their account id.                                                                                        |
| Player          | A player is an instance of an account in a game. An account can participate in multiple games, and so can have multiple players. However, an account can only be a single player in the same game. |
| Listing         | Public summary display of past and current games. Does not contain information about the gameplay.                                                                                                 |
| Lobby           | Operations on games outside of gameplay.                                                                                                                                                           |
| Gameplay        | Operations on games by players.                                                                                                                                                                    |
| Order           | Game actions submitted by players for a turn that will be applied during tick processing.                                                                                                          |
| Turn            | Period of time during which players decide which orders they want to submit.                                                                                                                       |
| Tick            | The computation of the next game state by applying this turn's orders.                                                                                                                             |
| Unit            | A generic player-owned entity located on exactly one Sector or Body.                                                                                                                               |
| Movement Target | The shared identity of a Sector or Body anywhere the game can locate an entity or use as a movement-graph endpoint.                                                                                |
