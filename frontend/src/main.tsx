import "./index.css"
import "./App.css"
import ReactDOM from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { StrictMode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BackendApiClient } from "./api/BackendApiClient.ts"
import { BackendApiClientProvider } from "./contexts/BackendApiClientContext.tsx"

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()
const backendApiClient = new BackendApiClient(import.meta.env.VITE_BACKEND_HOST as string)

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- root will always exist
const rootElement = document.getElementById("root")!

if (rootElement.innerHTML === "") {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BackendApiClientProvider backendApiClient={backendApiClient}>
          <RouterProvider router={router} />
        </BackendApiClientProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
