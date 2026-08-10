import { z } from "zod"

export type PlaywrightEnv = z.infer<typeof PlaywrightEnv>
/**
 * The schema for environment variables required by Playwright.
 * It also serves as documentation for the env.
 */
export const PlaywrightEnv = z.object({
  /**
   * Used by Clerk's Playwright testing helpers.
   */
  VITE_CLERK_PUBLISHABLE_KEY: z.string(),

  /**
   * Used by Clerk's Playwright testing helpers.
   */
  CLERK_SECRET_KEY: z.string(),

  /**
   * Identifies the existing Clerk development user used by authenticated tests.
   */
  E2E_CLERK_USER_EMAIL: z.string(),

  /**
   * Identifies the Postgres database used by the backend during the tests.
   */
  DATABASE_URL: z.string().default("postgres://user:pwd@localhost:5432/cosmic-empires"),

  /**
   * Port used by the backend started for Playwright.
   */
  E2E_BACKEND_PORT: z.coerce.number().default(3000),

  /**
   * Port used by the frontend started for Playwright.
   */
  E2E_FRONTEND_PORT: z.coerce.number().default(4173),
})

/**
 * Optionally loads an env file, then validates the variables required by Playwright.
 * Returns a type safe PlaywrightEnv object for further use.
 */
export function loadEnv({ envFilePath }: { envFilePath?: string } = {}): PlaywrightEnv {
  if (envFilePath !== undefined) {
    process.loadEnvFile(envFilePath)
  }

  const envResult = PlaywrightEnv.safeParse(process.env)
  if (!envResult.success) {
    // oxlint-disable-next-line no-console -- This is fine
    console.error("Incorrect env supplied to playwright, tests cannot run.")
    throw new Error(z.prettifyError(envResult.error))
  }

  return envResult.data
}
