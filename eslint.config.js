import { defineConfig, globalIgnores } from "eslint/config"
import eslintConfigs from "@shared/eslint"
import globals from "globals"

export default defineConfig([
  globalIgnores(["**/dist/**", "**/coverage/**", "*.gen.*"]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  eslintConfigs.configs.typescript,
  {
    files: ["backend/**/*"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["backend/scripts/**/*"],
    rules: {
      "no-console": "off", // Scripts don't need to use a logger, it's not part of the application runtime
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    ...eslintConfigs.configs.react,
  },
])
