import { PostgresRepository } from "./PostgresRepository.ts"
import { gamesTable, gameStatesTable, gameTicksTable } from "./schema.ts"
import { and, eq, lte, isNull } from "drizzle-orm"
import { Assert, type Logger } from "@guillaume-docquier/tools-ts"
import type { GameStateRow } from "#lib/db/gameStates.repository.ts"
import type { GameRow } from "#lib/db/games.repository.ts"

export type GameTickRow = typeof gameTicksTable.$inferSelect
export type GameTickRowInsert = typeof gameTicksTable.$inferInsert

export class GameTicksRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "ticks-repository" })
  }

  public async create(newGameTick: GameTickRowInsert): Promise<GameTickRow> {
    const gameTicks = await this.db.insert(gameTicksTable).values(newGameTick).returning()
    Assert.isTrue(gameTicks.length === 1)
    Assert.isDefined(gameTicks[0])

    return gameTicks[0]
  }

  public async getTicksToProcess(): Promise<Array<{ game: GameRow; gameTick: GameTickRow; gameState: GameStateRow }>> {
    const ticksToProcess = await this.db
      .select()
      .from(gameTicksTable)
      .innerJoin(gameStatesTable, eq(gameStatesTable.gameId, gameTicksTable.gameId))
      .innerJoin(gamesTable, eq(gamesTable.id, gameTicksTable.gameId))
      .where(and(isNull(gameTicksTable.processingStartedAt), lte(gameTicksTable.scheduledFor, new Date())))

    return ticksToProcess.map((tickToProcess) => ({
      game: tickToProcess.games,
      gameTick: tickToProcess.game_ticks,
      gameState: tickToProcess.game_states,
    }))
  }

  public async startProcessingTick({ gameId, tick }: { gameId: number; tick: number }): Promise<void> {
    await this.db
      .update(gameTicksTable)
      .set({ processingStartedAt: new Date() })
      .where(and(eq(gameTicksTable.gameId, gameId), eq(gameTicksTable.tick, tick)))
  }

  public async finishProcessingTick({ gameId, tick }: { gameId: number; tick: number }): Promise<void> {
    await this.db
      .update(gameTicksTable)
      .set({ processingEndedAt: new Date() })
      .where(and(eq(gameTicksTable.gameId, gameId), eq(gameTicksTable.tick, tick)))
  }
}
