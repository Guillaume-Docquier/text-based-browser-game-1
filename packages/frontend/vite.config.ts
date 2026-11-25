import { fileURLToPath } from "node:url"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type ServerOptions } from "vite"
import { devHttps } from "./devHttps.ts"
import { parseEnv } from "./src/parseEnv.ts"

export default defineConfig(({ command, mode, isPreview }) => {
  const envDir = fileURLToPath(new URL("../../", import.meta.url))
  const env = parseEnv({ env: loadEnv(mode, envDir) })
  const proxyRewriteRegex = new RegExp(`^${env.VITE_BACKEND_BASE_URL}`)

  const server: ServerOptions = {
    port: env.VITE_DEV_PORT,
    strictPort: true,
    watch: {
      ignored: ["**/storybook-static/**", "**/playwright/**", "**/playwright-report/**", "**/playwright.config.ts"],
    },
    // CONSTRAINT: Matches the reverse proxy configuration in production
    proxy: {
      [env.VITE_BACKEND_BASE_URL]: {
        target: env.VITE_BACKEND_HOST,
        changeOrigin: true,
        rewrite: (path): string => path.replace(proxyRewriteRegex, ""),
      },
    },
  }

  if (command === "serve" && isPreview !== true) {
    server.https = devHttps({ isCI: process.env.CI === "true" })
  }

  return {
    envDir,
    plugins: [
      tailwindcss(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routeTreeFileHeader: ["// @ts-nocheck", "// noinspection JSUnusedGlobalSymbols"],
      }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    server,
  }
})
