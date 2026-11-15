# Glossary

These are terms and their meaning in the context of this app.

| Term               | Description                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User               | An entity that owns an account, most likely a human. Each user is only allowed to have 1 account.                                                                                                  |
| Account            | All the data that identifies and is tied to a user in the system. Users are referenced by their account id.                                                                                        |
| Player             | A player is an instance of an account in a game. An account can participate in multiple games, and so can have multiple players. However, an account can only be a single player in the same game. |
| Home Planet        | The Planet assigned to a Player when a game starts.                                                                                                                                                |
| Game               | A match with one identity throughout creation, its lobby, active play, and completion.                                                                                                             |
| Game Listing       | A public overview of a game, including its status, player count, and the requesting account's membership.                                                                                          |
| Game Details       | Public game information, including configuration, players, lifecycle information, and the requesting player's available operations.                                                                |
| Game Configuration | The settings chosen when creating a game, including its name, seats, turn interval and optional map seed.                                                                                          |
| Lobby              | The pre-start phase of a game, during which players can join or leave before the creator starts it.                                                                                                |
| Gameplay           | Player-specific game views and operations, including Action submission and Readiness.                                                                                                              |
| Use Case           | An operation-specific backend application class that owns one business operation and its dependencies; a router calls it directly.                                                                 |
| Query              | Client input for a use case that reads data, defined beside the use case and separate from server-authoritative values.                                                                            |
| Command            | Client input for a use case that changes state, defined beside the use case and separate from server-authoritative values.                                                                         |
| Action             | Something a player can do that will affect the game state.                                                                                                                                         |
| Action Submission  | An action that a player has chosen to perform. Action submissions can be reverted while the turn is ongoing.                                                                                       |
| Turn               | The period during which players decide which Actions to submit.                                                                                                                                    |
| Ready              | The internal and gameplay term for a player whose Readiness is set. The UI presents this state as Locked in.                                                                                       |
| Readiness          | A public, reversible player state that locks a player's Actions. When all players are Ready, the Turn ends early.                                                                                  |
| Lock in            | The top-bar UI action that sets Readiness and makes the player Ready. The resulting Ready state is shown as Locked in; Cancel clears Readiness while the Turn is still collecting Actions.         |
| Turn Resolution    | The shared processing period after a Turn ends that computes the next game state.                                                                                                                  |
| Tick               | An internal precision sub-step within turn resolution where smaller time intervals can reduce ties.                                                                                                |
