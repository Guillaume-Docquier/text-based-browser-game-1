import { PostgresRepository } from "./PostgresRepository.ts"
import { playersTable } from "./schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"

export type PlayerRow = typeof playersTable.$inferSelect
export type PlayerRowInsert = typeof playersTable.$inferInsert

export class PlayersRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "players-repository" })
  }

  public async insert(newPlayer: PlayerRowInsert): Promise<Result<PlayerRow, string>> {
    const insertResult = await Result.tryCatch(async () => {
      const players = await this.db
        .insert(playersTable)
        .values({
          ...newPlayer,
          email: newPlayer.email?.toLowerCase(),
        })
        .returning()
      Assert.isTrue(players.length === 1)
      Assert.isDefined(players[0])

      return players[0]
    })

    if (Result.isFailure(insertResult)) {
      this.logger.error("Could not insert player", { newPlayer, error: insertResult.error })
      return Result.Failure(couldNot("insert player"))
    }

    return insertResult
  }

  public async findByAuthId({ authId }: { authId: string }): Promise<Result<PlayerRow | undefined, string>> {
    const findByAuthIdResult = await Result.tryCatch(async () => {
      const players = await this.db.select().from(playersTable).where(eq(playersTable.clerk_id, authId))
      Assert.isTrue(players.length <= 1)

      return players[0]
    })

    if (Result.isFailure(findByAuthIdResult)) {
      this.logger.error("Could not find player by auth id", { authId, error: findByAuthIdResult.error })
      return Result.Failure(couldNot("find player by auth id"))
    }

    return findByAuthIdResult
  }
}
