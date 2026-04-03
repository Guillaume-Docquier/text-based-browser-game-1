import { z } from "zod"
import type { Logger } from "@guillaume-docquier/tools-ts"

/**
 * The schema for the environment variables.
 * It also serves as documentation for the env.
 *
 * Default values are coherent across all services for dev.
 * Only keys that are 3rd party secret don't have default values, for safety.
 */
const envSchema = z.object({
  /**
   * Matches the reverse proxy path for the backend.
   */
  VITE_BACKEND_BASE_URL: z.string().default("/api"),

  /**
   * Used to configure the dev proxy, not used in prod (the reverse proxy does this).
   */
  VITE_BACKEND_HOST: z.string().default("http://localhost:3000"),

  /**
   * Fetch the dev key from clerk and keep put it in your .env file.
   */
  VITE_CLERK_PUBLISHABLE_KEY: z.string(),
})

/**
 * Parses the env to validate that the necessary variables are defined.
 * Returns a type safe Env object for further use.
 *
 * This should be the only consumer of `import.meta.env`.
 */
export function parseEnv({ logger, env = import.meta.env }: { logger?: Logger; env?: Record<string, unknown> } = {}): z.infer<
  typeof envSchema
> {
  const envResult = envSchema.safeParse(env)
  if (!envResult.success) {
    ;(logger ?? console).error("Some environment variables are missing or incorrect.")
    throw new Error(z.prettifyError(envResult.error))
  }

  return envResult.data
}
