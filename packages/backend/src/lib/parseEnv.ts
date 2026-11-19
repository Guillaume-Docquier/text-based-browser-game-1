import { z } from "zod"

export const BackendEnvSchema = z.object({
  // CONSTRAINT: PORT is injected by Railway and is not configurable, you can't rename this.
  PORT: z.coerce.number(),
  DATABASE_URL: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  // CONSTRAINT: test-header is only used for concurrency tests to bypass clerk.
  AUTH_SERVICE: z.enum(["clerk", "test-header"]).default("clerk"),
})

export function parseEnv<TEnvSchema extends z.ZodObject>({ schema }: { schema: TEnvSchema }): z.infer<TEnvSchema> {
  return schema.parse(process.env)
}
