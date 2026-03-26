import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { parseEnv } from "../src/parseEnv.ts"
import { gamesTable, usersTable } from "#db/schema.ts"
import { Pool } from "pg"
import { input } from "@inquirer/prompts"
import { sql } from "drizzle-orm"
import { type Table } from "drizzle-orm/table"

const YES_I_KNOW = "yes i know"

void main(parseEnv().DATABASE_URL)

/**
 * Populates the database with basic data.
 * This will first wipe the database.
 * You will be asked to confirm if you're seeding a database other than the localhost db, just in case.
 *
 * The db to seed is determined by the DATABASE_URL env var.
 */
async function main(connectionString: string): Promise<void> {
  const host = getDbHost(connectionString)
  if (!(await confirmSeeding(host))) {
    console.log("Saved your ass, lol.")
    return
  }

  console.log(`Seeding the '${host}' database with default values`)

  const pool = new Pool({ connectionString })
  const db = drizzle({ client: pool })

  const seedFuncs = [seedGames, seedUsers]
  for (const seedFunc of seedFuncs) {
    console.log("")
    await seedFunc(db)
  }
  console.log("")

  console.log("Seeding completed")
  await pool.end()
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

async function resetTable(db: NodePgDatabase, table: Table): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
}

async function seedGames(db: NodePgDatabase): Promise<void> {
  console.log("Games")
  console.log("├ Cleaning up the games")
  await resetTable(db, gamesTable)
  console.log("├ Adding the default game")
  await db.insert(gamesTable).values({ name: "default game", tick: 0 })
  console.log("└ Done")
}

async function seedUsers(db: NodePgDatabase): Promise<void> {
  console.log("Users")
  console.log("├ Cleaning up the users")
  await resetTable(db, usersTable)
  await db.delete(usersTable)
  console.log("├ Adding sample users")
  await db
    .insert(usersTable)
    .values([{ clerk_id: "fake1", email: "fake1@email.com" }, { clerk_id: "fake2", email: "fake2@email.com" }, { clerk_id: "fake3" }])
  console.log("└ Done")
}
