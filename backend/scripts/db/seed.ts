import { createDb, type Database } from "#lib/db/createDb.ts"
import { parseEnv } from "#lib/parseEnv.ts"
import { gamesTable, playersTable } from "#lib/db/schema.ts"
import { input } from "@inquirer/prompts"
import { sql } from "drizzle-orm"
import { type Table } from "drizzle-orm/table"
import { Assert, type Logger, type Result } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { PlayersRepository, type PlayerRow, type PlayerRowInsert } from "#lib/db/players/players.repository.ts"
import { GamesController } from "#api/games/games.controller.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { configureLogger } from "#lib/configureLogger.ts"
import { StarSystemGenerationSettingsRepository } from "#lib/db/star-systems/starSystemGenerationSettings.repository.ts"

const YES_I_KNOW = "yes i know"

const envSchema = z.object({
  /**
   * See the infra docker-compose file for the dev db url.
   * postgres://<user>:<pwd>@localhost:<port>/<db>
   */
  DATABASE_URL: z.string(),

  /**
   * Clerk id if adding yourself.
   */
  CLERK_ID: z.string().optional(),

  /**
   * User email if adding yourself.
   */
  USER_EMAIL: z.string().optional(),

  /**
   * User alias if adding yourself.
   */
  USER_ALIAS: z.string().optional(),
})

const env = parseEnv({ envSchema })
void main({
  connectionString: env.DATABASE_URL,
  user:
    env.CLERK_ID === undefined
      ? undefined
      : {
          clerkId: env.CLERK_ID,
          email: env.USER_EMAIL,
          alias: env.USER_ALIAS,
        },
})

type User = {
  clerkId: string
  email: string | undefined
  alias: string | undefined
}

/**
 * Populates the database with basic data.
 * This will first wipe the database.
 * You will be asked to confirm if you're seeding a database other than the localhost db, just in case.
 *
 * The db to seed is determined by the DATABASE_URL env var.
 */
async function main({ connectionString, user }: { connectionString: string; user: User | undefined }): Promise<void> {
  const logger = await configureLogger({ scope: "db-seed", nonBlocking: false })
  const host = getDbHost(connectionString)
  if (!(await confirmSeeding(host))) {
    logger.info("Saved your ass, lol.")
    return
  }

  logger.info(`Creating services`)
  const db = createDb({ databaseUrl: connectionString })
  const gamesRepository = new GamesRepository({ db, logger })
  const playersRepository = new PlayersRepository({ db, logger })
  const starSystemGenerationSettingsRepository = new StarSystemGenerationSettingsRepository({ db, logger })
  const gamesController = new GamesController({
    gamesRepository,
    starSystemGenerationSettingsRepository,
    createTransaction: db.transaction.bind(db),
    logger,
  })

  logger.info(`Seeding the '${host}' database with default values`)
  try {
    logger.info("")
    const players = await seedPlayers({ db, user, logger, playersRepository })

    logger.info("")
    await seedGames({ db, players, logger, gamesController })

    logger.info("")
    logger.info("Seeding completed")
  } finally {
    await db.$client.end()
  }
}

function getDbHost(connectionString: string): string {
  const [_, hostPortDb] = connectionString.split("@")
  if (hostPortDb === undefined) {
    throw new Error("No db host found in connection string")
  }

  const [host] = hostPortDb.split(":")
  if (host === undefined) {
    throw new Error("No db host found in connection string")
  }

  return host
}

async function confirmSeeding(host: string): Promise<boolean> {
  if (isLocal(host)) {
    return true
  }

  const doYouKnow = await input({
    message: `You're about to seed the '${host}' database that is not local.\nType '${YES_I_KNOW}' if that's what you intended.\n`,
  })

  return doYouKnow === YES_I_KNOW
}

function isLocal(host: string): boolean {
  return host === "localhost"
}

async function resetTable(db: Database, table: Table): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
}

async function seedPlayers({
  db,
  user,
  playersRepository,
  logger,
}: {
  db: Database
  user: User | undefined
  playersRepository: PlayersRepository
  logger: Logger
}): Promise<PlayerRow[]> {
  logger.info("Users")
  logger.info("├ Cleaning up the users")
  await resetTable(db, playersTable)
  logger.info("├ Adding sample users")
  const newPlayers: PlayerRowInsert[] = [
    ...(user !== undefined ? [{ clerk_id: user.clerkId, email: user.email, alias: user.alias }] : []),
    { clerk_id: "fake1", email: "fake1@email.com", alias: "fake1 name" },
    { clerk_id: "fake2", email: "fake2@email.com" },
    { clerk_id: "fake3" },
  ]

  const players: PlayerRow[] = []
  for (const newPlayer of newPlayers) {
    players.push(assertSuccess(await playersRepository.create(newPlayer)))
  }

  logger.info("└ Done")

  return players
}

async function seedGames({
  db,
  players,
  gamesController,
  logger,
}: {
  db: Database
  players: PlayerRow[]
  gamesController: GamesController
  logger: Logger
}): Promise<void> {
  const [firstPlayer, secondPlayer, thirdPlayer] = players
  Assert.isDefined(firstPlayer)
  Assert.isDefined(secondPlayer)
  Assert.isDefined(thirdPlayer)

  logger.info("Games")
  logger.info("├ Cleaning up the games")
  await resetTable(db, gamesTable)
  logger.info("├ Adding default games")
  const insanelyFastGame = assertSuccess(
    await gamesController.create({ name: "insanely fast game", createdByPlayerId: firstPlayer.id, nbSeats: 5, tickIntervalSeconds: 60 }),
  )
  assertSuccess(
    await gamesController.create({ name: "fast game", createdByPlayerId: secondPlayer.id, nbSeats: 10, tickIntervalSeconds: 7200 }),
  )
  logger.info("├ Adding players to games")
  assertSuccess(await gamesController.join({ gameId: insanelyFastGame.id, playerId: secondPlayer.id }))
  assertSuccess(await gamesController.join({ gameId: insanelyFastGame.id, playerId: thirdPlayer.id }))
  logger.info("└ Done")
}

/**
 * Nothing throws for the application, but here if something goes wrong, we just want to abort loudly
 */
function assertSuccess<TSuccess>(result: Result<TSuccess, string>): TSuccess {
  Assert.isSuccess(result)
  return result.value
}
