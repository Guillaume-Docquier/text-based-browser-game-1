import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "#shared/turn-resolution": process.cwd() } },
  test: { name: "turn-resolution", reporters: ["default"] },
})
