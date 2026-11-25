import { type Branded, Assert, branded, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { and, desc, eq, gt } from "drizzle-orm"
import type { GameId } from "shared/domain/games/GameId.ts"
import type { PlayerId } from "shared/domain/players/PlayerId.ts"
import { TurnStatus } from "shared/domain/turns/TurnStatus.ts"
import type { Star } from "shared/domain/world/stars/Star.ts"
import { GetPlayerViewError, GetPlayerViewRollbackError } from "#api/gameplay/getPlayerView.error.ts"
import type { PlayerView } from "#api/gameplay/PlayerView.ts"
import { TurnStateError } from "#api/gameplay/turnState.error.ts"
import type { TurnState } from "#api/gameplay/TurnState.ts"
import { UpdateReadinessError, UpdateReadinessRollbackError } from "#api/gameplay/updateReadiness.error.ts"
import type { Clock } from "#lib/Clock.ts"
import type { Transaction } from "#lib/db/createDb.ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { planetsTable, playersTable, starsTable, turnsTable, turnsProcessingTable } from "#lib/db/schema.ts"

type PlayerReadiness = Readonly<{
  id: PlayerId
  isReady: boolean
}>

export type ReadinessForUpdate = Branded<
  "ReadinessForUpdate",
  Readonly<{
    gameId: GameId
    playerId: PlayerId
    turn: number
    players: readonly PlayerReadiness[]
  }>
>

export class GameplayRepository extends PostgresRepository {
  private readonly logger: Logger
  private readonly clock: Clock

  public constructor({ logger, db, clock }: { logger: Logger; db: PostgresRepository["db"]; clock: Clock }) {
    super({ db })
    this.logger = logger.child({ scope: "gameplay-repository" })
    this.clock = clock
  }

  public async getPlayerView(
    { gameId, playerId }: { gameId: GameId; playerId: PlayerId },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerView, GetPlayerViewError>> {
    const playerViewResult = await Result.tryCatch(
      db.transaction(
        async (tx) => {
          const turns = await tx
            .select({
              turn: turnsTable.turn,
            })
            .from(turnsTable)
            .where(eq(turnsTable.gameId, gameId))
            .orderBy(desc(turnsTable.turn))
            .limit(1)
          Assert.isTrue(turns.length <= 1)

          const turn = turns[0]
          if (turn === undefined) {
            throw new GetPlayerViewRollbackError(GetPlayerViewError.TURN_NOT_FOUND)
          }

          const players = await tx
            .select({
              id: playersTable.playerId,
              color: playersTable.color,
            })
            .from(playersTable)
            .where(eq(playersTable.gameId, gameId))
          const player = players.find(({ id }) => id === playerId)
          Assert.isDefined(player)
          const opponents = Object.fromEntries(players.filter(({ id }) => id !== playerId).map((opponent) => [opponent.id, opponent]))

          const stars = await tx.select().from(starsTable).where(eq(starsTable.gameId, gameId)).orderBy(starsTable.id)
          const planets = await tx.select().from(planetsTable).where(eq(planetsTable.gameId, gameId)).orderBy(planetsTable.id)

          return {
            player,
            opponents,
            galaxy: toGalaxyModel({ stars, planets }),
            gameId,
            turn: turn.turn,
          }
        },
        { isolationLevel: "repeatable read" },
      ),
    )

    if (Result.isFailure(playerViewResult)) {
      this.logger.error("Could not get player game state by ids", { gameId, playerId, error: playerViewResult.error })
      if (playerViewResult.error instanceof GetPlayerViewRollbackError) {
        return Result.Failure(playerViewResult.error.code)
      }

      return Result.Failure(GetPlayerViewError.UNKNOWN)
    }

    return playerViewResult
  }

  public async getTurnState(gameId: GameId): Promise<Result<TurnState, TurnStateError>> {
    const currentTurn = this.db
      .select({ gameId: turnsTable.gameId, turn: turnsTable.turn, turnStatus: turnsTable.status, turnEndsAt: turnsTable.endsAt })
      .from(turnsTable)
      .where(eq(turnsTable.gameId, gameId))
      .orderBy(desc(turnsTable.turn))
      .limit(1)
      .as("current_turn")

    const result = await Result.tryCatch(
      this.db
        .select({
          turn: currentTurn.turn,
          turnStatus: currentTurn.turnStatus,
          turnEndsAt: currentTurn.turnEndsAt,
          player: { id: playersTable.playerId, isReady: playersTable.isReady },
        })
        .from(currentTurn)
        .leftJoin(playersTable, eq(playersTable.gameId, currentTurn.gameId))
        .execute(),
    )

    if (Result.isFailure(result)) {
      this.logger.error("Could not read turn state", { gameId, error: result.error })
      return Result.Failure(TurnStateError.UNKNOWN)
    }

    const current = result.value[0]
    if (current === undefined) {
      return Result.Failure(TurnStateError.TURN_NOT_FOUND)
    }

    const readinessByPlayerId = Object.fromEntries(
      result.value.flatMap(({ player }) => (player === null ? [] : [[player.id, player.isReady]])),
    )
    return Result.Success({
      turn: current.turn,
      turnStatus: current.turnStatus,
      turnEndsAt: current.turnEndsAt,
      readinessByPlayerId,
    })
  }

  public async getReadinessForUpdate(
    { gameId, turn, playerId }: { gameId: GameId; turn: number; playerId: PlayerId },
    tx: Transaction,
  ): Promise<ReadinessForUpdate> {
    const gameTurns = await tx
      .select({
        gameId: turnsTable.gameId,
        turn: turnsTable.turn,
        endsAt: turnsTable.endsAt,
      })
      .from(turnsTable)
      .where(
        and(
          eq(turnsTable.gameId, gameId),
          eq(turnsTable.turn, turn),
          eq(turnsTable.status, TurnStatus.COLLECTING_ACTIONS),
          gt(turnsTable.endsAt, this.clock.now()),
        ),
      )
      .for("no key update")
    Assert.isTrue(gameTurns.length <= 1)

    const gameTurn = gameTurns[0]
    if (gameTurn === undefined) {
      throw new UpdateReadinessRollbackError(UpdateReadinessError.TURN_NOT_OPEN)
    }

    const players = await tx
      .select({ id: playersTable.playerId, isReady: playersTable.isReady })
      .from(playersTable)
      .where(eq(playersTable.gameId, gameId))
    Assert.isTrue(players.some((player) => player.id === playerId))

    return branded({ gameId, turn, playerId, players })
  }

  public async updateReadiness({ context, isReady }: { context: ReadinessForUpdate; isReady: boolean }, tx: Transaction): Promise<void> {
    await tx
      .update(playersTable)
      .set({ isReady })
      .where(and(eq(playersTable.gameId, context.gameId), eq(playersTable.playerId, context.playerId)))
  }

  public async closeTurn({ context, closedAt }: { context: ReadinessForUpdate; closedAt: Date }, tx: Transaction): Promise<void> {
    await tx
      .update(turnsTable)
      .set({ closedAt, status: TurnStatus.AWAITING_PROCESSING })
      .where(and(eq(turnsTable.gameId, context.gameId), eq(turnsTable.turn, context.turn)))

    await tx
      .update(turnsProcessingTable)
      .set({ scheduledFor: closedAt })
      .where(and(eq(turnsProcessingTable.gameId, context.gameId), eq(turnsProcessingTable.turn, context.turn)))
  }
}

function toGalaxyModel({
  stars,
  planets,
}: {
  stars: ReadonlyArray<typeof starsTable.$inferSelect>
  planets: ReadonlyArray<typeof planetsTable.$inferSelect>
}): PlayerView["galaxy"] {
  const planetsByStarId = Map.groupBy(planets, (planet) => planet.starId)
  const systems = stars.map((star) => ({
    star: toStarModel(star),
    planets: planetsByStarId.get(star.id) ?? [],
  }))

  return { systems }
}

function toStarModel({ id, name, coordinates, x, y }: typeof starsTable.$inferSelect): Star {
  return { id, name, coordinates, x, y }
}
