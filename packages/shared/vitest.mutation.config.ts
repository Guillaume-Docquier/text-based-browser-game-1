import { defineConfig, mergeConfig } from "vitest/config"
import sharedConfig from "./vitest.config.ts"

export default mergeConfig(sharedConfig, defineConfig({ test: { reporters: ["default"] } }))
