import { defineConfig, globalIgnores } from "eslint/config"
import eslintConfigs from "@tooling/eslint"
import globals from "globals"

export default defineConfig([
  globalIgnores(["**/dist/**"]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    files: ["backend/**/*"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["frontend/**/*"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  eslintConfigs.configs.typescript,
])
