import "@/index.css"
import { ClerkProvider, useAuth } from "@clerk/react"
import { dark } from "@clerk/ui/themes"
import { Logger, createConsoleLogSink, prettyConsoleFormatter } from "@guillaume-docquier/tools-ts"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { type ReactElement, StrictMode, useState } from "react"
import ReactDOM from "react-dom/client"
import { Onboarding } from "@/features/auth/Onboarding.tsx"
import { createBackendApiClient } from "@/lib/api/BackendApiClient.ts"
import { BackendApiClientProvider } from "@/lib/api/BackendApiClientContext.tsx"
import { LoggerProvider } from "@/lib/LoggerContext.tsx"
import { parseEnv } from "@/parseEnv.ts"
import type { RouterContext } from "@/routes/__root.tsx"
import { routeTree } from "@/routeTree.gen"

const logger = await Logger.configure({
  sinks: {
    console: createConsoleLogSink({
      formatter: prettyConsoleFormatter,
      redaction: { enabled: false },
    }),
  },
})

const env = parseEnv({ logger })

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
          <App />
        </ClerkProvider>
      </LoggerProvider>
    </StrictMode>,
  )
}

function App(): ReactElement {
  const auth = useAuth()
  if (!auth.isLoaded) {
    return <></>
  }

  // Mount a fresh cache and router when the signed-in account changes.
  return <AuthSession key={auth.userId ?? "signed-out"} auth={auth} />
}

function AuthSession({ auth }: RouterContext): ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // GET game/bad_id retries, but it'll never work. Why retry?
            retry: false,
          },
        },
      }),
  )
  const [backendApiClient] = useState(() => createBackendApiClient({ baseUrl: env.VITE_BACKEND_BASE_URL, queryClient }))
  const [router] = useState(() => createAppRouter({ auth }))

  return (
    <QueryClientProvider client={queryClient}>
      <BackendApiClientProvider backendApiClient={backendApiClient}>
        <Onboarding>
          <RouterProvider router={router} context={{ auth }} />
        </Onboarding>
      </BackendApiClientProvider>
    </QueryClientProvider>
  )
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
