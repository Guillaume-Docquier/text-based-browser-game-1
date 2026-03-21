import { Outlet, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { ReactElement } from "react"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent(): ReactElement {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
