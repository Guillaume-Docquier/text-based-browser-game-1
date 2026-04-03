import { defineConfig, loadEnv } from "vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import babel from "@rolldown/plugin-babel"
import tanstackRouter from "@tanstack/router-plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import { parseEnv } from "./src/parseEnv"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = parseEnv({ env: loadEnv(mode, process.cwd()) })
  const proxyRewriteRegex = new RegExp(`^${env.VITE_BACKEND_BASE_URL}`)

  return {
    plugins: [
      tailwindcss(),
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    // Can't use until https://github.com/vitejs/vite/issues/21889 is fixed
    // resolve: {
    //   tsconfigPaths: true,
    // },
    server: {
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
