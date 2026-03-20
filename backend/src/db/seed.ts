import { drizzle } from "drizzle-orm/node-postgres"
import { parseEnv } from "../parseEnv.ts"
import { gamesTable } from "./schema.ts"
import { Pool } from "pg"
import { input } from "@inquirer/prompts"

function isLocal(host: string): boolean {
  return host === "localhost"
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

const YES_I_KNOW = "yes i know"

async function main(connectionString: string): Promise<void> {
  const host = getDbHost(connectionString)
  if (!isLocal(host)) {
    const doYouKnow = await input({
      message: `You're about to seed the '${host}' database that is not local.\nType '${YES_I_KNOW}' if that's what you intended.\n`,
    })
    if (doYouKnow !== YES_I_KNOW) {
      console.log("Saved your ass, lol.")
      return
    }
  }

  console.log(`Seeding the '${host}' database with default values`)

  const pool = new Pool({ connectionString })
  const db = drizzle({ client: pool })

  console.log("Games")
  console.log("├ Cleaning up the games")
  await db.delete(gamesTable)
  console.log("├ Adding the default game")
  await db.insert(gamesTable).values({ name: "default game", tick: 0 })
  console.log("└ Done")

  console.log("Seeding completed")
  await pool.end()
}

void main(parseEnv().DATABASE_URL)
