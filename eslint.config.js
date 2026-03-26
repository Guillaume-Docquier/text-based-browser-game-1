import { defineConfig, globalIgnores } from "eslint/config"
import eslintConfigs from "@shared/eslint"
import globals from "globals"

export default defineConfig([
  globalIgnores(["**/dist/**", "*.gen.*"]),
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
    files: ["frontend/**/*.{ts,tsx}"],
    ...eslintConfigs.configs.react,
  },
  eslintConfigs.configs.typescript,
])
