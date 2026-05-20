import { createDb, type Database } from "#lib/db/createDb.ts"
import { parseEnv } from "#lib/parseEnv.ts"
import { gamePlayersTable, gamesTable, playersTable } from "#lib/db/schema.ts"
import { input } from "@inquirer/prompts"
import { sql } from "drizzle-orm"
import { type Table } from "drizzle-orm/table"
import { Assert } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

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

  const db = createDb({ databaseUrl: connectionString })

  const seedFuncs = [seedPlayers, seedGames]
  for (const seedFunc of seedFuncs) {
    console.log("")
    await seedFunc(db, user)
  }
  console.log("")

  console.log("Seeding completed")
  await db.$client.end()
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

async function seedPlayers(db: Database, user: User | undefined): Promise<void> {
  console.log("Users")
  console.log("├ Cleaning up the users")
  await resetTable(db, playersTable)
  await db.delete(playersTable)
  console.log("├ Adding sample users")
  await db
    .insert(playersTable)
    .values([
      ...(user !== undefined ? [{ clerk_id: user.clerkId, email: user.email, alias: user.alias }] : []),
      { clerk_id: "fake1", email: "fake1@email.com", alias: "fake1 name" },
      { clerk_id: "fake2", email: "fake2@email.com" },
      { clerk_id: "fake3" },
    ])
  console.log("└ Done")
}

async function seedGames(db: Database): Promise<void> {
  const players = await db.select().from(playersTable)
  Assert.isDefined(players[0])
  Assert.isDefined(players[1])
  Assert.isDefined(players[2])

  console.log("Games")
  console.log("├ Cleaning up the games")
  await resetTable(db, gamesTable)
  console.log("├ Adding default games")
  const games = await db
    .insert(gamesTable)
    .values([
      { name: "insanely fast game", createdByPlayerId: players[0].id, nbSeats: 5, tickIntervalSeconds: 60 },
      { name: "fast game", createdByPlayerId: players[1].id, nbSeats: 10, tickIntervalSeconds: 7200 },
    ])
    .returning()
  console.log("├ Adding players to games")
  Assert.isDefined(games[0])

  await db.insert(gamePlayersTable).values([
    // Add creators to their games
    ...games.map((game) => ({ gameId: game.id, playerId: game.createdByPlayerId })),
    // Extra players for game 0
    { gameId: games[0].id, playerId: players[1].id },
    { gameId: games[0].id, playerId: players[2].id },
  ])
  console.log("└ Done")
}
