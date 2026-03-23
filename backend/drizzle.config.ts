import { defineConfig } from "drizzle-kit"
import { parseEnv } from "./src/parseEnv.ts"
import * as fs from "node:fs"

const envFromFile = fs
  .readFileSync(".env", "utf-8")
  .split("\n")
  .map((line) => line.split("="))

for (const [key, value] of envFromFile) {
  if (key !== undefined && value !== undefined) {
    process.env[key.trim()] = value.trim()
  }
}

const env = parseEnv()

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
