import { parseEnv } from "./parseEnv.ts"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createApp } from "./createApp.ts"
import { UsersRepository } from "#db/UsersRepository.ts"
import { GamesRepository } from "#db/GamesRepository.ts"
import { AuthService } from "#auth/auth.service.ts"
import pRetry from "p-retry"

void main()

/**
 * The main entrypoint for the backend
 */
async function main(): Promise<void> {
  console.log("Parsing environment")
  const env = parseEnv()

  console.log("Connecting to the database")
  const db = await connectToDatabase({ connectionString: env.DATABASE_URL })

  console.log("Performing database migration")
  await migrate(db, { migrationsFolder: "./drizzle/" })

  const usersRepository = new UsersRepository({ db })
  const gamesRepository = new GamesRepository({ db })

  const authService = new AuthService()

  console.log("Creating the API")
  const app = await createApp({ usersRepository, gamesRepository, authService })

  // Listen to all interfaces (::) for railway's IPv6 internal network
  app.listen(env.PORT, "::", () => {
    console.log(`API listening on port ${env.PORT}`)
  })
}

/**
 * At the time of writing, the DB was in "serverless" mode, meaning it might be sleeping when we deploy the backend.
 * Retrying should quickly work that out.
 * Long term the DB won't be "serverless", so this issue should go away.
 */
async function connectToDatabase({ connectionString }: { connectionString: string }): Promise<NodePgDatabase> {
  return await pRetry(
    () =>
      drizzle({
        connection: {
          connectionString,
          // I probably want ssl?
          // ssl: true,
        },
      }),
    {
      retries: 5,
      onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
        console.error("Failed to connect to the database, retrying", { error, attemptNumber, retriesLeft })
      },
    },
  )
}
