import { Outlet, createRootRouteWithContext, Navigate } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { ReactElement } from "react"
import type { useAuth } from "@clerk/react"

export interface RouterContext {
  auth: ReturnType<typeof useAuth>
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: () => {
    return <Navigate to="/" replace />
  },
})

function RootComponent(): ReactElement {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
