import * as fs from "node:fs"
import { defineConfig } from "drizzle-kit"
import { envSchema, parseEnv } from "#lib/parseEnv.ts"

const envFromFile = fs
  .readFileSync(".env", "utf-8")
  .split("\n")
  .map((line) => line.split("="))

for (const [key, value] of envFromFile) {
  if (key !== undefined && value !== undefined) {
    process.env[key.trim()] = value.trim()
  }
}

const env = parseEnv({ schema: envSchema })

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
