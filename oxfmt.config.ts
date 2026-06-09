import { defineConfig } from "oxfmt"

export default defineConfig({
  printWidth: 140,
  semi: false,
  sortPackageJson: {
    sortScripts: true,
  },
  sortImports: {
    newlinesBetween: false,
  },
  ignorePatterns: ["pnpm-lock.yaml", "dist", ".pnpm-store", "*.gen.*"],
})
