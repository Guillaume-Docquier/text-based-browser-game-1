import { z } from "zod"

export type PlaywrightEnv = z.infer<typeof PlaywrightEnvSchema>
const PlaywrightEnvSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  DATABASE_URL: z.string().default("postgres://user:pwd@localhost:5432/cosmic-empires"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  VITE_DEV_PORT: z.coerce.number().int().min(1).max(65535).default(5173),
  CI: z
    .union([z.boolean(), z.literal(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .default(false),
})

export function parseEnv({ envFilePath }: { envFilePath?: string } = {}): PlaywrightEnv {
  if (envFilePath !== undefined) {
    process.loadEnvFile(envFilePath)
  }

  return PlaywrightEnvSchema.parse(process.env)
}
