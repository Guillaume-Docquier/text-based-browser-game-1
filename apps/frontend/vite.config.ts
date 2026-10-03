import { fileURLToPath } from "node:url"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { parseEnv } from "./src/parseEnv.ts"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL("../../", import.meta.url))
  const env = parseEnv({ env: loadEnv(mode, envDir) })
  const proxyRewriteRegex = new RegExp(`^${env.VITE_BACKEND_BASE_URL}`)

  return {
    envDir,
    plugins: [
      tailwindcss(),
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routeTreeFileHeader: ["/* oxlint-disable */", "// @ts-nocheck", "// noinspection JSUnusedGlobalSymbols"],
      }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      host: "127.0.0.1",
      port: env.VITE_DEV_PORT,
      strictPort: true,
      watch: {
        ignored: ["**/storybook-static/**", "**/playwright/**", "**/playwright-report/**", "**/playwright.config.ts"],
      },
      // Matches the reverse proxy configuration in production
      proxy: {
        [env.VITE_BACKEND_BASE_URL]: {
          target: env.VITE_BACKEND_HOST,
          changeOrigin: true,
          rewrite: (path): string => path.replace(proxyRewriteRegex, ""),
        },
      },
    },
  }
})
