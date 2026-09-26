import { react, typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"
import { Boundaries } from "./boundaries.ts"

export default defineConfig({
  extends: [typescript],
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
  jsPlugins: ["eslint-plugin-boundaries"],
  settings: {
    ...Boundaries.settings,
  },
  rules: {
    "boundaries/dependencies": ["error", Boundaries.dependencies],
  },
  overrides: [
    {
      files: ["backend/**/*"],
      env: {
        node: true,
      },
    },
    {
      ...vitest,
      files: ["**/*.test.ts"],
    },
    {
      files: ["backend/src/**/*.ts"],
      excludeFiles: ["backend/src/**/*.test.ts"],
      rules: {
        "no-restricted-globals": ["error", { name: "Date", message: "Use an injected clock instead." }],
      },
    },
    {
      files: ["backend/scripts/**/*"],
      rules: {
        "no-console": "off",
      },
    },
    {
      ...react,
      files: ["frontend/**/*.{ts,tsx}"],
      excludeFiles: ["frontend/playwright/**/*"],
    },
  ],
} satisfies OxlintConfig)
