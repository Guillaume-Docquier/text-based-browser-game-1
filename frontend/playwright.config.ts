import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"
import { loadEnv } from "./playwright/loadEnv.ts"

const frontendDirectory = dirname(fileURLToPath(import.meta.url))
const backendDirectory = resolve(frontendDirectory, "../backend")
const isCI = process.env.CI === "true"

const env = loadEnv({ envFilePath: isCI ? undefined : resolve(frontendDirectory, ".env") })
const backendUrl = `http://127.0.0.1:${env.E2E_BACKEND_PORT}`
const frontendUrl = `http://127.0.0.1:${env.E2E_FRONTEND_PORT}`

export default defineConfig({
  metadata: {
    env,
  },
  testDir: "./playwright",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm start",
      cwd: backendDirectory,
      env: {
        CLERK_PUBLISHABLE_KEY: env.VITE_CLERK_PUBLISHABLE_KEY,
        CLERK_SECRET_KEY: env.CLERK_SECRET_KEY,
        DATABASE_URL: env.DATABASE_URL,
        PORT: env.E2E_BACKEND_PORT.toString(),
      },
      url: `${backendUrl}/health`,
      reuseExistingServer: !isCI,
    },
    {
      command: `pnpm dev --host 127.0.0.1 --port ${env.E2E_FRONTEND_PORT}`,
      env: {
        VITE_BACKEND_HOST: backendUrl,
        VITE_CLERK_PUBLISHABLE_KEY: env.VITE_CLERK_PUBLISHABLE_KEY,
      },
      url: frontendUrl,
      reuseExistingServer: !isCI,
    },
  ],
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: isCI ? ["setup"] : [],
    },
  ],
})
