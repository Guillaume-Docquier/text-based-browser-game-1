import dotenv from "dotenv"
import { z } from "zod"

const envSchema = z.object({
  FRONTEND_HOST: z.string(),
  PORT: z.coerce.number(),
})

export function parseEnv(): z.infer<typeof envSchema> {
  dotenv.config({ quiet: true })
  return envSchema.parse(process.env)
}
