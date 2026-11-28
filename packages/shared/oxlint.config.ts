import { defineConfig, type OxlintConfig } from "oxlint"
import baseConfig from "../../oxlint.config.ts"
import { Boundaries } from "./boundaries.ts"

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: baseConfig.ignorePatterns,
  settings: Boundaries.settings,
  rules: Boundaries.rules,
  overrides: [
    {
      files: ["src/galaxy-creation/createGalaxy.test.ts"],
      plugins: ["vitest"],
      rules: { "vitest/valid-title": ["error", { mustMatch: { it: "^GC-(?:[A-Z]{2,4}-)?[0-9]{4} .+" } }] },
    },
    {
      files: ["src/turn-resolution/resolveTurn.test.ts"],
      plugins: ["vitest"],
      rules: { "vitest/valid-title": ["error", { mustMatch: { it: "^TR-(?:[A-Z]{2,4}-)?[0-9]{4} .+" } }] },
    },
  ],
} satisfies OxlintConfig)
