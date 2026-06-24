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
})

/**
 * Parses the env file to validate that the variables required by Playwright are defined.
 * Returns a type safe PlaywrightEnv object for further use.
 */
export function loadEnv({ envFilePath }: { envFilePath: string }): PlaywrightEnv {
  process.loadEnvFile(envFilePath)

  const envResult = PlaywrightEnv.safeParse(process.env)
  if (!envResult.success) {
    // oxlint-disable-next-line no-console -- This is fine
    console.error("Incorrect env supplied to playwright, tests cannot run.")
    throw new Error(z.prettifyError(envResult.error))
  }

  return envResult.data
}
