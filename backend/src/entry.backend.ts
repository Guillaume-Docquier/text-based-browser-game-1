import { parseEnv } from "./parseEnv.ts"
import { drizzle } from "drizzle-orm/node-postgres"
import { createApp } from "./createApp.ts"

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

  const app = await createApp({ db })

  // Listen to all interfaces (::) for railway's IPv6 internal network
  app.listen(env.PORT, "::", () => {
    console.log(`App listening on port ${env.PORT}`)
  })
}
