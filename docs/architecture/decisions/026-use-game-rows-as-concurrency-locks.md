# Use game rows as concurrency locks

## Status

Accepted

## Context

Many operations read game state, check rules, and then write to several tables. Examples include joining, leaving, starting, submitting orders, and processing ticks.

Requests for the same game can run at the same time. A transaction alone does not stop two requests from reading the same state and both acting on it. Locking each related table separately would be hard to apply in the same way everywhere. It would also make deadlocks more likely if code locks tables in a different order.

[ADR 010](./010-router-controller-repository.md) says controllers own business decisions and repositories own database access. We need a lock pattern that keeps that split.

## Decision

Use the row in `gamesTable` as the shared lock for operations on one game that need to be atomic.

The operation must start a transaction and lock the game row before it reads state used for a decision. Use a row-level lock such as `FOR NO KEY UPDATE`. An update to the game row also takes a row-level lock. Operations on different games can still run at the same time.

When an operation also locks other rows, lock the game row first. Keep the transaction open until all reads and writes for the operation are done. Do not perform network calls or other slow work while holding the lock.

Controller and repository code should use a `getForOperation` and `operation` method pair when the controller needs to make the decision. For example:

- `getGameForStart` and `startGame`
- `getLobbyForJoin` and `joinLobby`
- `getLobbyForLeave` and `leaveLobby`

The `getForOperation` method:

- receives the transaction;
- locks the game row;
- reads the state needed by the controller;
- returns a branded model such as `GameForStart` or `LobbyForJoin`.

The controller checks the rules and decides what to store. It then calls the paired repository method with a model that includes the branded value and passes the same transaction.

The paired repository method only writes the decision. It does not repeat business rules that belong in the controller.

The branded model shows that the locking read happened. TypeScript cannot prove that both calls use the same transaction. The caller must keep this rule.

Small operations may use one repository method when the rule and write can be done safely in one database statement. They must still lock or update the game row when they need to be ordered with other operations on that game.

## Consequences

Operations on the same game run one at a time while they hold the game-row lock. This prevents stale reads from causing conflicting writes across related tables.

The lock rule is easy to find and does not depend on which child tables an operation uses. New game operations have one clear row to lock first.

Controllers keep the business rules. Repositories keep the SQL and lock details. The branded models make the read and write pair clear in method signatures.

This pattern adds transaction plumbing and operation-specific models. The type system cannot enforce use of the same transaction.

Long transactions block other work on the same game. Code must keep locked sections short and use the same lock order. Tests for concurrent game operations need real PostgreSQL because PGLite does not implement correct row-lock behavior.
