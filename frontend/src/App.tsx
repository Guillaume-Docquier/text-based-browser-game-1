import { type ReactElement } from "react"
import "./App.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BackendApiClient } from "./api/BackendApiClient.ts"
import { BackendApiClientProvider } from "./contexts/BackendApiClientContext.tsx"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { rootRoute } from "./pages/Root.tsx"
import { homePageRoute } from "./pages/HomePage.tsx"
import { anotherPageRoute } from "./pages/AnotherPage.tsx"

const queryClient = new QueryClient()
const backendApiClient = new BackendApiClient(import.meta.env.VITE_BACKEND_HOST as string)

const router = createRouter({
  routeTree: rootRoute.addChildren([homePageRoute, anotherPageRoute]),
})

export default function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BackendApiClientProvider backendApiClient={backendApiClient}>
        <RouterProvider router={router} />
      </BackendApiClientProvider>
    </QueryClientProvider>
  )
}
