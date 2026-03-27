import "./index.css"
import "./App.css"
import ReactDOM from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { StrictMode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BackendApiClient } from "./api/BackendApiClient.ts"
import { BackendApiClientProvider } from "./contexts/BackendApiClientContext.tsx"
import { ClerkProvider } from "@clerk/react"
import { Logger, createConsoleLogSink, jsonLineFormatter, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"
import { LoggerProvider } from "./contexts/LoggerContext.tsx"

const isProd = import.meta.env.NODE_ENV === "production"
await Logger.configure({
  sinks: {
    console: createConsoleLogSink({
      formatter: isProd ? jsonLineFormatter : prettyConsoleFormatter,
      redaction: { enabled: isProd },
    }),
  },
}).then((logger) => {
  logger.info("logger initialized", { isProd })
})

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
const backendApiClient = new BackendApiClient()

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- root will always exist
const rootElement = document.getElementById("root")!

if (rootElement.innerHTML === "") {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <LoggerProvider logger={Logger.get()}>
        <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
          <QueryClientProvider client={queryClient}>
            <BackendApiClientProvider backendApiClient={backendApiClient}>
              <RouterProvider router={router} />
            </BackendApiClientProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </LoggerProvider>
    </StrictMode>,
  )
}
