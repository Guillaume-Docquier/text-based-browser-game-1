import "./index.css"
import ReactDOM from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { type ReactElement, StrictMode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createBackendApiClient } from "./api/BackendApiClient.ts"
import { BackendApiClientProvider } from "./contexts/BackendApiClientContext.tsx"
import { ClerkProvider, useAuth } from "@clerk/react"
import { dark } from "@clerk/ui/themes"
import { Logger, createConsoleLogSink, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"
import { LoggerProvider } from "./contexts/LoggerContext.tsx"
import { parseEnv } from "./parseEnv.ts"
import type { RouterContext } from "./routes/__root.tsx"

const logger = await Logger.configure({
  sinks: {
    console: createConsoleLogSink({
      formatter: prettyConsoleFormatter,
      redaction: { enabled: false },
    }),
  },
})

const env = parseEnv({ logger })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // GET game/bad_id retries, but it'll never work. Why retry?
      retry: false,
    },
  },
})
const backendApiClient = createBackendApiClient({ baseUrl: env.VITE_BACKEND_BASE_URL, queryClient })

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- root will always exist
const rootElement = document.getElementById("root")!

if (rootElement.innerHTML === "") {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <LoggerProvider logger={Logger.get()}>
        <ClerkProvider
          publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
          appearance={{
            theme: dark,
          }}
        >
          <QueryClientProvider client={queryClient}>
            <BackendApiClientProvider backendApiClient={backendApiClient}>
              <App />
            </BackendApiClientProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </LoggerProvider>
    </StrictMode>,
  )
}

function App(): ReactElement {
  const auth = useAuth()
  const router = createAppRouter({ auth })

  return <RouterProvider router={router} />
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Let tanstack inference do the work
function createAppRouter({ auth }: RouterContext) {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    context: {
      auth,
    },
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
