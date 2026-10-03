import { z } from "zod"

export type PlaywrightEnv = z.infer<typeof PlaywrightEnvSchema>
/**
 * The schema for environment variables required by Playwright.
 * It also serves as documentation for the env.
 */
export const PlaywrightEnvSchema = z.object({
  /**
   * Used by Clerk's Playwright testing helpers.
   */
  VITE_CLERK_PUBLISHABLE_KEY: z.string(),

  /**
   * Used by Clerk's Playwright testing helpers.
   */
  CLERK_SECRET_KEY: z.string(),

  /**
   * Identifies the Postgres database used by the backend during the tests.
   */
  DATABASE_URL: z.string().default("postgres://user:pwd@localhost:5432/cosmic-empires"),

  /**
   * Port used by the backend started for Playwright.
   */
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /**
   * Port used by the frontend started for Playwright.
   */
  VITE_DEV_PORT: z.coerce.number().int().min(1).max(65535).default(5173),

  /**
   * True when on the CI, this is automatic.
   */
  CI: z
    .union([z.boolean(), z.literal(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .default(false),
})

/**
 * Optionally loads an env file, then validates the variables required by Playwright.
 * Returns a type safe PlaywrightEnv object for further use.
 */
export function parseEnv({ envFilePath }: { envFilePath?: string } = {}): PlaywrightEnv {
  if (envFilePath !== undefined) {
    process.loadEnvFile(envFilePath)
  }

  return PlaywrightEnvSchema.parse(process.env)
}
