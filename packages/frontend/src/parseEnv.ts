import { z } from "zod"

type FrontendEnv = z.infer<typeof FrontendEnvSchema>

const FrontendEnvSchema = z.object({
  DEV: z.boolean().default(false),
  VITE_BACKEND_BASE_URL: z.string().default("/api"),
  VITE_BACKEND_HOST: z.string().default("http://localhost:3000"),
  VITE_DEV_PORT: z.coerce.number().int().min(1).max(65535).default(5173),
  VITE_CLERK_PUBLISHABLE_KEY: z.string(),
})

export function parseEnv({ env = import.meta.env }: { env?: Record<string, unknown> } = {}): FrontendEnv {
  return FrontendEnvSchema.parse(env)
}
