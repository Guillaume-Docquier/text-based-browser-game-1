import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"

const frontendDirectory = dirname(fileURLToPath(import.meta.url))
const envFile = resolve(frontendDirectory, ".env")

if (existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

process.env.CLERK_PUBLISHABLE_KEY ??= process.env.VITE_CLERK_PUBLISHABLE_KEY

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      testMatch: /.*\.public\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
    },
    {
      name: "authenticated chromium",
      testMatch: /.*\.authenticated\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.clerk/user.json",
      },
      dependencies: ["setup"],
    },
  ],
})
