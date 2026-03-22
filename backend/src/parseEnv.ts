import { z } from "zod"

const envSchema = z.object({
  FRONTEND_HOST: z.string(),
  PORT: z.coerce.number(),
  DATABASE_URL: z.string(),
})

export function parseEnv(): z.infer<typeof envSchema> {
  const envResult = envSchema.safeParse(process.env)
  if (!envResult.success) {
    throw new Error(z.prettifyError(envResult.error))
  }

  return envResult.data
}
