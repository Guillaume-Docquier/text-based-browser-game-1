import { defineConfig, loadEnv } from "vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import babel from "@rolldown/plugin-babel"
import tanstackRouter from "@tanstack/router-plugin/vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), babel({ presets: [reactCompilerPreset()] })],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_HOST ?? "http://localhost:3000",
          changeOrigin: true,
          rewrite: (path): string => path.replace(/^\/api/, ""),
        },
      },
    },
  }
})
