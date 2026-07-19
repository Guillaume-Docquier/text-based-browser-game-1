import base from "@guillaume-docquier/oxfmt"
import { defineConfig } from "oxfmt"

export default defineConfig({
  ...base,
  ignorePatterns: ["pnpm-lock.yaml", "dist", ".pnpm-store", "*.gen.*"],
})
