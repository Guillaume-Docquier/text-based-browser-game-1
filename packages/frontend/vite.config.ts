import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { getCertificate } from "@vitejs/plugin-basic-ssl"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type ServerOptions, type UserConfig } from "vite"
import { parseEnv } from "./src/parseEnv.ts"

export default defineConfig(async ({ command, mode }): Promise<UserConfig> => {
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
        routeTreeFileHeader: ["// @ts-nocheck", "// noinspection JSUnusedGlobalSymbols"],
      }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      https: command === "serve" ? await loadDevHttps() : undefined,
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
    },
  }
})

async function loadDevHttps(): Promise<ServerOptions["https"]> {
  const certPath = new URL("./.dev-tls/localhost.pem", import.meta.url)
  const keyPath = new URL("./.dev-tls/localhost-key.pem", import.meta.url)
  if (existsSync(certPath) && existsSync(keyPath)) {
    const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)])
    return { cert, key }
  }

  const cacheDir = fileURLToPath(new URL("./node_modules/.vite/basic-ssl", import.meta.url))
  const certificate = await getCertificate(cacheDir, "localhost", ["localhost"])
  return { cert: certificate, key: certificate }
}
