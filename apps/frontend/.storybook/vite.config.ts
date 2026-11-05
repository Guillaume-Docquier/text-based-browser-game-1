import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // Prebundle primitives before dynamically imported stories start their tests.
    include: [
      "@base-ui/react/combobox",
      "@base-ui/react/dialog",
      "@base-ui/react/scroll-area",
      "@base-ui/react/select",
      "@base-ui/react/separator",
      "@base-ui/react/slider",
      "@base-ui/react/use-render",
    ],
  },
})
