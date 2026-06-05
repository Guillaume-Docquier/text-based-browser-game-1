import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { playersTable } from "#lib/db/schema.ts"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Result } from "@guillaume-docquier/tools-ts"
import { couldNot } from "#lib/errors.ts"

type NewPlayerRow = typeof playersTable.$inferInsert
type PlayerRow = typeof playersTable.$inferSelect

export type NewPlayerModel = NewPlayerRow
export type PlayerModel = PlayerRow

export class PlayersRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "players-repository" })
  }

  /**
   * Creates a new player and returns the created player with its generated id.
   * If the creation fails, a Failure is returned with a reason.
   */
  public async create(newPlayer: NewPlayerModel, db: PostgresRepository["db"] = this.db): Promise<Result<PlayerModel, string>> {
    const createPlayerResult = await Result.tryCatch(async () => {
      const players = await db
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

    if (Result.isFailure(createPlayerResult)) {
      this.logger.error("Could not create player", { newPlayer, error: createPlayerResult.error })
      return Result.Failure(couldNot("create player"))
    }

    return createPlayerResult
  }

  /**
   * Gets a player by the auth id.
   * Returns undefined when no matching player was found.
   * Returns a Failure when an error prevented getting the user. The user might exist, but we couldn't retrieve it.
   */
  public async getByAuthId(
    { authId }: { authId: string },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<PlayerModel | undefined, string>> {
    const findByAuthIdResult = await Result.tryCatch(async () => {
      const players = await db.select().from(playersTable).where(eq(playersTable.clerk_id, authId))
      Assert.isTrue(players.length <= 1)

      return players[0]
    })

    if (Result.isFailure(findByAuthIdResult)) {
      this.logger.error("Could not get player by auth id", { authId, error: findByAuthIdResult.error })
      return Result.Failure(couldNot("get player by auth id"))
    }

    return findByAuthIdResult
  }
}
