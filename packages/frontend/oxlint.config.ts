import { react } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"
import baseConfig from "../../oxlint.config.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  overrides: [
    {
      files: ["**/*.stories.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "vitest",
                message: "Use storybook/test for instrumented story assertions and test helpers.",
              },
              {
                name: "@storybook/test",
                message: "Use storybook/test with the installed Storybook version.",
              },
              {
                name: "@storybook/testing-library",
                message: "Use storybook/test and the play context's canvas and userEvent.",
              },
              {
                name: "@storybook/jest",
                message: "Use storybook/test for story assertions.",
              },
              {
                name: "@storybook/react",
                importNames: ["Meta", "StoryObj"],
                message: "Import story types from @storybook/react-vite.",
              },
            ],
          },
        ],
      },
    },
    {
      ...react,
      files: ["**/*.{ts,tsx}"],
      excludeFiles: ["playwright/**/*"],
    },
  ],
} satisfies OxlintConfig)
