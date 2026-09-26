import path from "node:path"
import { react, typescript, vitest } from "@guillaume-docquier/oxlint"
import { defineConfig, type OxlintConfig } from "oxlint"

export default defineConfig({
  extends: [typescript],
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
  jsPlugins: ["eslint-plugin-boundaries"],
  settings: {
    "boundaries/root-path": import.meta.dirname,
    "boundaries/elements": [
      { type: "ruleset-model", pattern: "backend/src/lib/rules-engine/ruleset-model", partialMatch: false },
      { type: "validation", pattern: "backend/src/lib/validation", partialMatch: false },
      { type: "db", pattern: "backend/src/lib/db", partialMatch: false },
    ],
    "boundaries/flag-as-external": {
      unresolvableAlias: false,
      inNodeModules: true,
    },
    "import/resolver": {
      typescript: {
        project: path.resolve(import.meta.dirname, "backend/tsconfig.json"),
      },
    },
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
      files: ["backend/src/lib/rules-engine/ruleset-model/**/*.ts"],
      rules: {
        "boundaries/dependencies": [
          "error",
          {
            default: "disallow",
            checkAllOrigins: true,
            checkUnknownLocals: true,
            checkInternals: true,
            policies: [
              { allow: { to: { module: { origin: "external" } } } },
              { allow: { to: { element: { type: ["ruleset-model", "validation", "db"] } } } },
            ],
          },
        ],
      },
    },
    {
      ...react,
      files: ["frontend/**/*.{ts,tsx}"],
      excludeFiles: ["frontend/playwright/**/*"],
    },
  ],
} satisfies OxlintConfig)
