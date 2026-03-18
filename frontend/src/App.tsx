import { type ReactElement } from "react"
import "./App.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BackendApiClient } from "./api/BackendApiClient.ts"
import { HomePage } from "./pages/HomePage.tsx"
import { BackendApiClientProvider } from "./contexts/BackendApiClientContext.tsx"

const queryClient = new QueryClient()
const backendApiClient = new BackendApiClient("http://localhost:3000")

export default function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BackendApiClientProvider backendApiClient={backendApiClient}>
        <HomePage />
      </BackendApiClientProvider>
    </QueryClientProvider>
  )
}
