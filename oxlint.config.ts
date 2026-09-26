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
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        checkAllOrigins: false,
        checkUnknownLocals: true,
        checkInternals: true,
        policies: [
          {
            from: { element: { type: "ruleset-model" } },
            disallow: { to: { module: { origin: "local" } } },
          },
          {
            from: { element: { type: "ruleset-model" } },
            allow: { to: { element: { type: ["ruleset-model", "validation", "db"] } } },
          },
        ],
      },
    ],
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
