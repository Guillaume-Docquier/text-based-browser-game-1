import { z } from "zod"

/**
 * The schema for the environment variables.
 * It also serves as documentation for the env.
 *
 * Default values are coherent across all services for dev.
 * Only keys that are 3rd party secret don't have default values, for safety.
 */
const envSchema = z.object({
  /**
   * PORT is injected by Railway and is not configurable, you can't rename this.
   */
  PORT: z.coerce.number(),

  /**
   * See the infra docker-compose file for the dev db url
   * postgres://<user>:<pwd>@localhost:<port>/<db>
   */
  DATABASE_URL: z.string(),

  /**
   * Fetch the dev key from clerk and keep put it in your .env file
   */
  CLERK_PUBLISHABLE_KEY: z.string(),

  /**
   * Fetch the dev key from clerk and keep put it in your .env file
   */
  CLERK_SECRET_KEY: z.string(),
})

/**
 * Parses the env to validate that the necessary variables are defined.
 * Returns a type safe Env object for further use.
 *
 * This should be the only consumer of `process.env`.
 */
export function parseEnv(): z.infer<typeof envSchema> {
  const envResult = envSchema.safeParse(process.env)
  if (!envResult.success) {
    console.error("Some environment variables are missing or incorrect.")
    throw new Error(z.prettifyError(envResult.error))
  }

  return envResult.data
}
