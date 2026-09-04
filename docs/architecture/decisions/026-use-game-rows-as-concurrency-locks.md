# Use game rows as concurrency locks

## Status

Accepted

## Context

Many lobby operations read game state, check rules, and then write to several tables. Examples include joining, leaving, and starting a game. Active gameplay operations also need a stable lock while they read and write the current Turn.

Requests for the same game can run at the same time. A transaction alone does not stop two requests from reading the same state and both acting on it. Locking each related table separately would be hard to apply in the same way everywhere. It would also make deadlocks more likely if code locks tables in a different order.

[ADR 010](./010-router-controller-repository.md) says controllers own business decisions and repositories own database access. We need a lock pattern that keeps that split.

## Decision

Use the row in `gamesTable` as the shared lock for lobby operations on one game that need to be atomic. This includes joining, leaving, and starting a game.

Use the current row in `turnsTable` as the shared lock for active gameplay operations, including Action submission and Turn processing. The Turn row is the authoritative source for the current turn status and deadline. These operations must not acquire the game row lock.

The operation must start a transaction and lock its owning row before it reads state used for a decision. Use a row-level lock such as `FOR NO KEY UPDATE`. An update to the row also takes a row-level lock. Operations on different games can still run at the same time.

The TurnProcessor first promotes expired collecting turns to `AWAITING_PROCESSING` with an update that locks each matching turn row. It then claims a queued turn with `SKIP LOCKED` and changes it to `PROCESSING`. Action submission locks the same turn row and checks that it is still collecting actions and its deadline is in the future. Whichever transaction acquires the lock first determines whether the submission is accepted before the turn is closed.

When a lobby operation also locks other rows, lock the game row first. Active gameplay operations lock the Turn row instead. Keep the transaction open until all reads and writes for the operation are done. Do not perform network calls or other slow work while holding the lock.

Controller and repository code should use a `getForOperation` and `operation` method pair when the controller needs to make the decision. For example:

- `getGameForStart` and `startGame`
- `getLobbyForJoin` and `joinLobby`
- `getLobbyForLeave` and `leaveLobby`

Gameplay repository methods use the same transaction while locking the current Turn row.

The `getForOperation` method:

- receives the transaction;
- locks the owning game or Turn row;
- reads the state needed by the controller;
- returns a branded model such as `GameForStart` or `LobbyForJoin`.

The controller checks the rules and decides what to store. It then calls the paired repository method with a model that includes the branded value and passes the same transaction.

The paired repository method only writes the decision. It does not repeat business rules that belong in the controller.

The branded model shows that the locking read happened. TypeScript cannot prove that both calls use the same transaction. The caller must keep this rule.

Small operations may use one repository method when the rule and write can be done safely in one database statement. They must still lock or update the owning game or Turn row when they need to be ordered with other operations on that game.

## Consequences

Lobby operations on the same game run one at a time while they hold the game-row lock. Active gameplay operations on the same turn run one at a time while they hold the turn-row lock, which prevents action submission from racing with turn closure or processing.

The lock rule is easy to find and does not depend on which child tables an operation uses. New lobby operations have one clear row to lock first, and active gameplay operations have one current-turn row to lock first.

Controllers keep the business rules. Repositories keep the SQL and lock details. The branded models make the read and write pair clear in method signatures.

This pattern adds transaction plumbing and operation-specific models. The type system cannot enforce use of the same transaction.

Long transactions block other work on the same game or turn. Code must keep locked sections short and use the same lock order. Tests for concurrent operations need real PostgreSQL because PGLite does not implement correct row-lock behavior.
