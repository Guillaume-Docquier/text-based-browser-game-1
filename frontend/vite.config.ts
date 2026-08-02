import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import tanstackRouter from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { parseEnv } from "./src/parseEnv.ts"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = parseEnv({ env: loadEnv(mode, process.cwd()) })
  const proxyRewriteRegex = new RegExp(`^${env.VITE_BACKEND_BASE_URL}`)

  return {
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
