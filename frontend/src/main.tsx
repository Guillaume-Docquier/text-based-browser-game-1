import "./index.css"
import { ClerkProvider, useAuth } from "@clerk/react"
import { dark } from "@clerk/ui/themes"
import { Logger, createConsoleLogSink, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { type ReactElement, StrictMode, useMemo } from "react"
import ReactDOM from "react-dom/client"
import { createBackendApiClient } from "./lib/api/BackendApiClient.ts"
import { BackendApiClientProvider } from "./lib/api/BackendApiClientContext.tsx"
import { LoggerProvider } from "./lib/LoggerContext.tsx"
import { parseEnv } from "./parseEnv.ts"
import type { RouterContext } from "./routes/__root.tsx"
import { routeTree } from "./routeTree.gen"

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

// oxlint-disable-next-line typescript/no-non-null-assertion -- root will always exist
const rootElement = document.getElementById("root")!

if (rootElement.innerHTML === "") {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <LoggerProvider logger={logger}>
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
  const router = useMemo(
    () => createAppRouter({ auth }),
    // Recreate the router for auth transitions, but not Clerk token refreshes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- The router only reads these auth properties in route guards
    [auth.isLoaded, auth.isSignedIn],
  )

  return <RouterProvider router={router} />
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- Let tanstack inference do the work
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
