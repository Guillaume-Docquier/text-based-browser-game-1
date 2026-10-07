import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig, mergeConfig } from "vitest/config"
import storybookViteConfig from "./.storybook/vite.config.ts"

export default mergeConfig(
  storybookViteConfig,
  defineConfig({
    test: {
      reporters: ["default", "junit"],
      outputFile: { junit: "./test-results/storybook/results.xml" },
      attachmentsDir: "./test-results/storybook",
      projects: [
        {
          plugins: [
            storybookTest({
              configDir: ".storybook",
              storybookScript: "pnpm storybook --no-open",
            }),
          ],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              screenshotFailures: true,
              instances: [{ browser: "chromium" }],
            },
          },
        },
        {
          extends: true,
          plugins: [react()],
          // Prebundle the page's icons before native tests start, avoiding a Vite reload mid-test.
          optimizeDeps: { include: ["lucide-react"] },
          test: {
            name: "storybook-native",
            include: ["src/**/*.browser.test.{ts,tsx}"],
            setupFiles: ["./.storybook/vitest.setup.ts"],
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              screenshotFailures: true,
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  }),
)
