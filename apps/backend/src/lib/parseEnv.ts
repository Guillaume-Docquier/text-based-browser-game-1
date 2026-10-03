import { z } from "zod"

/**
 * The schema for the environment variables.
 * It also serves as documentation for the env.
 */
export const BackendEnvSchema = z.object({
  /**
   * Railpack supplies production on Railway; local commands default to development.
   */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * PORT is injected by Railway and is not configurable, you can't rename this.
   */
  PORT: z.coerce.number(),

  /**
   * See the infra docker-compose file for the dev db url.
   * postgres://<user>:<pwd>@localhost:<port>/<db>
   */
  DATABASE_URL: z.string(),

  /**
   * Fetch the dev key from clerk and keep put it in your .env file.
   */
  CLERK_PUBLISHABLE_KEY: z.string(),

  /**
   * Fetch the dev key from clerk and keep put it in your .env file.
   */
  CLERK_SECRET_KEY: z.string(),

  /**
   * Allows tests to exercise the real API entry point without Clerk test credentials.
   */
  AUTH_SERVICE: z.enum(["clerk", "test-header"]).default("clerk"),
})

/**
 * Parses the env to validate that the necessary variables are defined.
 * Returns a type safe Env object for further use.
 *
 * This should be the only consumer of `process.env`.
 */
export function parseEnv<TEnvSchema extends z.ZodObject>({ schema }: { schema: TEnvSchema }): z.infer<TEnvSchema> {
  return schema.parse(process.env)
}
