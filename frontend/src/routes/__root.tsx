import type { useAuth } from "@clerk/react"
import { Outlet, createRootRouteWithContext, Navigate } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { ReactElement } from "react"

export interface RouterContext {
  auth: ReturnType<typeof useAuth> & { readonly isLoaded: true }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootRoute,
  notFoundComponent: () => {
    return <Navigate to="/" replace />
  },
})

function RootRoute(): ReactElement {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
