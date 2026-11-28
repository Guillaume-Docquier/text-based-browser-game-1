import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "#shared/galaxy-creation": process.cwd() } },
  test: { name: "galaxy-creation", reporters: ["default"] },
})
