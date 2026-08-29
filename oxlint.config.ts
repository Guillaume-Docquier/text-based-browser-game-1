import { react, typescript } from "@guillaume-docquier/oxlint"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [typescript],
  options: {
    reportUnusedDisableDirectives: "deny",
    denyWarnings: true,
  },
  ignorePatterns: ["*.gen.*"],
  overrides: [
    {
      files: ["backend/**/*"],
      env: {
        node: true,
      },
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
      rules: {
        ...react.rules,
        "react/refs": "off", // creates too many false positives because of an old and still open bug: https://github.com/react/react/issues/34775
      },
    },
  ],
})
