import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"
import { parseEnv } from "./playwright/parseEnv.ts"

const frontendDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.resolve(frontendDirectory, "../backend")
const isCI = process.env.CI === "true"

const env = parseEnv({ envFilePath: isCI ? undefined : path.resolve(frontendDirectory, "../../.env") })
const backendUrl = `http://127.0.0.1:${env.PORT}`
const frontendUrl = `http://127.0.0.1:${env.VITE_DEV_PORT}`

const isUiMode = process.argv.includes("--ui")

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm start",
      cwd: backendDirectory,
      env: {
        CLERK_PUBLISHABLE_KEY: env.VITE_CLERK_PUBLISHABLE_KEY,
        CLERK_SECRET_KEY: env.CLERK_SECRET_KEY,
        DATABASE_URL: env.DATABASE_URL,
        PORT: env.PORT.toString(),
      },
      url: `${backendUrl}/health`,
      reuseExistingServer: !isCI,
    },
    {
      command: `pnpm dev --host 127.0.0.1 --port ${env.VITE_DEV_PORT}`,
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
      use: {
        video: "retain-on-failure",
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        video: "retain-on-failure",
      },
      // avoids running the setup on every run when using the playwright ui because it slows down tests a lot when debugging
      // it does mean your auth can get stale, and you need to know to manually run the setup again
      // when running headless, we always run the setup for a clean run
      dependencies: isUiMode ? [] : ["setup"],
    },
  ],
})
