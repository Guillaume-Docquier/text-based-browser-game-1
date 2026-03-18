import dotenv from "dotenv"
import { z } from "zod"

const envSchema = z.object({
  FRONTEND_HOST: z.string(),
  FRONTEND_PORT: z.coerce.number(),
  API_PORT: z.coerce.number(),
})

export function parseEnv(): z.infer<typeof envSchema> {
  dotenv.config({ quiet: true })
  return envSchema.parse(process.env)
}
