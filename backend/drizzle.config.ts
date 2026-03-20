import "dotenv/config"
import { defineConfig } from "drizzle-kit"
import { parseEnv } from "./src/parseEnv.ts"

const env = parseEnv()

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
