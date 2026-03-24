import { parseEnv } from "./parseEnv.ts"
import { drizzle } from "drizzle-orm/node-postgres"
import { createApp } from "./createApp.ts"
import { UsersRepository } from "#db/UsersRepository.ts"
import { GamesRepository } from "#db/GamesRepository.ts"
import { AuthService } from "#auth/auth.service.ts"

const env = parseEnv()

void main()
async function main(): Promise<void> {
  const db = drizzle({
    connection: {
      connectionString: env.DATABASE_URL,
      // I probably want ssl?
      // ssl: true,
    },
  })

  const usersRepository = new UsersRepository({ db })
  const gamesRepository = new GamesRepository({ db })

  const authService = new AuthService()

  const app = await createApp({ usersRepository, gamesRepository, authService })

  // Listen to all interfaces (::) for railway's IPv6 internal network
  app.listen(env.PORT, "::", () => {
    console.log(`App listening on port ${env.PORT}`)
  })
}
