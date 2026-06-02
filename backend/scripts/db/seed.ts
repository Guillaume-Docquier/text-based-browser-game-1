import { drizzle } from "drizzle-orm/node-postgres"
import type { Database } from "#lib/db/createDb.ts"
import { parseEnv } from "#lib/parseEnv.ts"
import { gamesTable, playersTable } from "#lib/db/schema.ts"
import { Pool } from "pg"
import { input } from "@inquirer/prompts"
import { sql } from "drizzle-orm"
import { type Table } from "drizzle-orm/table"
import { Assert, type Logger, Result, type Result as TResult } from "@guillaume-docquier/tools-ts"
import { z } from "zod"
import { PlayersRepository, type PlayerRow, type PlayerRowInsert } from "#lib/db/players/players.repository.ts"
import { GamesController } from "#api/games/games.controller.ts"
import { GamesRepository } from "#lib/db/games/games.repository.ts"
import { configureLogger } from "#lib/configureLogger.ts"

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
  const host = getDbHost(connectionString)
  if (!(await confirmSeeding(host))) {
    console.log("Saved your ass, lol.")
    return
  }

  console.log(`Seeding the '${host}' database with default values`)

  const pool = new Pool({ connectionString })
  const db = drizzle({ client: pool })
  const logger = await configureLogger({ scope: "db-seed", nonBlocking: false })
  const services = createSeedServices({ db, logger })

  try {
    console.log("")
    const players = await seedPlayers({ db, user, playersRepository: services.playersRepository })
    console.log("")
    await seedGames({ db, players, gamesController: services.gamesController })
    console.log("")

    console.log("Seeding completed")
  } finally {
    await pool.end()
  }
}

function createSeedServices({ db, logger }: { db: Database; logger: Logger }): {
  playersRepository: PlayersRepository
  gamesController: GamesController
} {
  const gamesRepository = new GamesRepository({ db, logger })

  return {
    playersRepository: new PlayersRepository({ db, logger }),
    gamesController: new GamesController({ gamesRepository, logger }),
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
}: {
  db: Database
  user: User | undefined
  playersRepository: PlayersRepository
}): Promise<PlayerRow[]> {
  console.log("Users")
  console.log("├ Cleaning up the users")
  await resetTable(db, playersTable)
  console.log("├ Adding sample users")
  const players: PlayerRow[] = []
  const newPlayers: PlayerRowInsert[] = [
    ...(user !== undefined ? [createPlayerInsertFromUser({ user })] : []),
    { clerk_id: "fake1", email: "fake1@email.com", alias: "fake1 name" },
    { clerk_id: "fake2", email: "fake2@email.com" },
    { clerk_id: "fake3" },
  ]

  for (const newPlayer of newPlayers) {
    players.push(extractSuccess(await playersRepository.create(newPlayer)))
  }

  console.log("└ Done")

  return players
}

function createPlayerInsertFromUser({ user }: { user: User }): PlayerRowInsert {
  return {
    clerk_id: user.clerkId,
    ...(user.email !== undefined ? { email: user.email } : {}),
    ...(user.alias !== undefined ? { alias: user.alias } : {}),
  }
}

async function seedGames({
  db,
  players,
  gamesController,
}: {
  db: Database
  players: PlayerRow[]
  gamesController: GamesController
}): Promise<void> {
  const [firstPlayer, secondPlayer, thirdPlayer] = players
  Assert.isDefined(firstPlayer)
  Assert.isDefined(secondPlayer)
  Assert.isDefined(thirdPlayer)

  console.log("Games")
  console.log("├ Cleaning up the games")
  await resetTable(db, gamesTable)
  console.log("├ Adding default games")
  const insanelyFastGame = extractSuccess(
    await gamesController.create({ name: "insanely fast game", createdByPlayerId: firstPlayer.id, nbSeats: 5, tickIntervalSeconds: 60 }),
  )
  extractSuccess(
    await gamesController.create({ name: "fast game", createdByPlayerId: secondPlayer.id, nbSeats: 10, tickIntervalSeconds: 7200 }),
  )
  console.log("├ Adding players to games")
  extractSuccess(await gamesController.join({ gameId: insanelyFastGame.id, playerId: secondPlayer.id }))
  extractSuccess(await gamesController.join({ gameId: insanelyFastGame.id, playerId: thirdPlayer.id }))
  console.log("└ Done")
}

function extractSuccess<TSuccess>(result: TResult<TSuccess, string>): TSuccess {
  if (Result.isFailure(result)) {
    throw new Error(result.error)
  }

  return result.value
}
