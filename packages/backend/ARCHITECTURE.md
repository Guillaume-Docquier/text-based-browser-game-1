# Backend architecture

The API uses Express, tRPC, Drizzle, Postgres and Clerk auth.

| Directory                                                    | Description                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| [`src/api`](src/api/ARCHITECTURE.md)                         | API vertical slices organized as router-useCase-repository.                                              |
| `src/lib`                                                    | Code shared by the API and Turn Processing, including the [database schema](src/lib/db/ARCHITECTURE.md). |
| [`src/turn-processing`](src/turn-processing/ARCHITECTURE.md) | Turn Processing worker and orchestration hosted by the API process.                                      |

There is no backend build. Node 26+ runs TypeScript natively, so code requires isolated modules and cannot use features such as enums or decorators.

Turn Processing is isolated so workers can scale independently or move to another runtime later. Turn Processing must not depend on the API.

Keep Clerk calls in the auth service and Drizzle queries in repositories. See [ADR-006](../../docs/architecture/decisions/006-abstracting-3rd-parties.md).

## Migrations

Generate migrations with `pnpm --filter backend db:generate --name <descriptive-migration-name>`. Always pass `--name`. The backend applies migrations at startup. At the current project stage, the database can be reset after schema changes without a backfill. See [ADR-025](../../docs/architecture/decisions/025-backend-initiated-db-migrations.md).

Use the Drizzle TypeScript schema for the objects it can generate. Put handwritten SQL that drizzle cannot generate, such as trigger functions and triggers, in [migrations/](./migrations/). Use `NNNN_descriptive-name.sql` with the next available number and a unique name. The name identifies the migration in the Drizzle journal. The source number controls the order among handwritten files.

Sync the custom migrations with `pnpm --filter backend db:sync-custom`. `pnpm db:nuke` handles the custom migrations as well.

Every handwritten file must work after the current schema is generated. See [ADR-036](../../docs/architecture/decisions/036-keep-handwritten-postgresql-schema-sql-outside-generated-migrations.md).

## Live turn state

The authenticated `gameplay.turnState` subscription sends complete snapshots to game members. Each API process has one dedicated PostgreSQL listener. The gameplay use case reads a game only while it has subscribers, shares each refresh across those subscribers, and serializes the reads. After `LISTEN` is re-established, the API refreshes all active subscriptions. The browser receives a heartbeat every 15 seconds and reconnects after 45 seconds of silence. See [ADR-037](../../docs/architecture/decisions/037-use-server-sent-events-over-http-2.md).

## Transactions and locks

Lock the owning row before reading state used for a decision. Joining, leaving, and starting a game lock the game row. Readiness and Turn Processing lock the current Turn row. Keep the lock and writes in the same transaction. See [ADR-026](../../docs/architecture/decisions/026-use-game-rows-as-concurrency-locks.md).

## Drizzle Gotchas

- Do not call `tx.rollback()`. It throws at runtime, but TypeScript does not know that, so it breaks control-flow narrowing. Throw an operation-specific subclass of `TransactionRollbackError` instead, e.g. `throw new UpdateReadinessRollbackError(UpdateReadinessError.TURN_NOT_OPEN)`. Define the subclass in the companion `*.error.ts` module and import it from there; the base class may only be imported in `*.error.ts` files. See [ADR-033](../../docs/architecture/decisions/033-router-use-case-repository.md#use-case).
- Do not return `Result` values from transaction callbacks. Throw the operation-specific rollback error to abort the transaction, or return the value directly. Let rollback errors escape the callback so Drizzle rolls back; convert them to an operation failure only after the transaction has rejected, as described in [ADR-013](../../docs/architecture/decisions/013-use-results-and-never-throw.md).
- Do not add `runInTransaction` helpers or flatten nested transaction calls. Drizzle supports nested transactions. If a method must run inside an existing transaction, type its argument as a transaction; otherwise let it create a transaction for its own unit of work.
