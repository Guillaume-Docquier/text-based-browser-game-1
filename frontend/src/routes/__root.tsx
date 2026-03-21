import { Outlet, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { ReactElement } from "react"
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent(): ReactElement {
  return (
    <>
      <header>
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
