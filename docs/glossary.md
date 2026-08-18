# Glossary

These are terms and their meaning in the context of this app.

| Term                      | Description                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                      | An entity that owns an account, most likely a human. Each user is only allowed to have 1 account.                                                                                                  |
| Account                   | All the data that identifies and is tied to a user in the system. Users are referenced by their account id.                                                                                        |
| Player                    | A player is an instance of an account in a game. An account can participate in multiple games, and so can have multiple players. However, an account can only be a single player in the same game. |
| Listing                   | Public summary display of past and current games. Does not contain information about the gameplay.                                                                                                 |
| Lobby                     | Operations on games outside of gameplay.                                                                                                                                                           |
| Gameplay                  | Operations on games by players.                                                                                                                                                                    |
| Ruleset                   | The persisted rules used by one game, including its Action Definitions, Mechanics, and other game settings.                                                                                        |
| Action Definition         | Declarative Ruleset content that describes an Action's presentation, Mechanics, source and input requirements, and target slots.                                                                   |
| Available Action Instance | A currently usable instance of an Action Definition, with the exact source, input, and target candidates supplied by the server.                                                                   |
| Action                    | Player-facing shorthand for an Action Definition, Available Action Instance, or Action Submission when the distinction is not important.                                                           |
| Action Submission         | A player's proposed use of an Available Action Instance, including their selected source, inputs, and targets.                                                                                     |
| Mechanic                  | A reusable, configured rule within an Action Definition that produces game behavior.                                                                                                               |
| Effect                    | A concrete attempt to apply game behavior produced from a Mechanic during Turn Resolution.                                                                                                         |
| Effect Outcome            | The recorded result of resolving an Effect: either `Resolved` when applied or `Prevented` as an expected game result.                                                                              |
| Resolved Action           | An Action Submission and its Effect Outcomes after the Turn has been resolved.                                                                                                                     |
| Turn                      | The period during which players decide which Actions to submit.                                                                                                                                    |
| Turn Resolution           | The shared processing period after a Turn ends that computes the next game state.                                                                                                                  |
| Phase                     | An engine-owned, ordered stage of Turn Resolution that determines when a category of Effects resolves.                                                                                             |
| Tick                      | An internal precision sub-step within the Movement Phase used to sequence movement progress and arrivals.                                                                                          |
