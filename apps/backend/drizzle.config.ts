import { defineConfig } from "drizzle-kit"
import { BackendEnvSchema, parseEnv } from "#lib/parseEnv.ts"

process.loadEnvFile(new URL("../../.env", import.meta.url))

const env = parseEnv({ schema: BackendEnvSchema })

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
