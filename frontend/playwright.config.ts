import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"
import { loadEnv } from "./playwright/loadEnv.ts"

const frontendDirectory = dirname(fileURLToPath(import.meta.url))
const backendDirectory = resolve(frontendDirectory, "../backend")

const env = loadEnv({ envFilePath: resolve(frontendDirectory, ".env") })

export default defineConfig({
  metadata: {
    env,
  },
  testDir: "./playwright",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev",
      cwd: backendDirectory,
      url: "http://127.0.0.1:3000/health",
      reuseExistingServer: true,
    },
    {
      command: "pnpm dev --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
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
      dependencies: ["setup"],
    },
  ],
})
