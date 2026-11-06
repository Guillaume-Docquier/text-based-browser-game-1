import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
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
      ],
    },
  }),
)
