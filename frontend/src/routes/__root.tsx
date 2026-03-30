import { Outlet, createRootRoute, Link } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { ReactElement } from "react"
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent(): ReactElement {
  return (
    <>
      <header className="h-16 bg-blue-950 p-3 flex justify-between text-white">
        <Link className="flex-1 h-full w-auto flex items-center gap-2 text-2xl font-bold" to="/">
          <img src="src/assets/logo.png" alt="logo" className="h-full w-auto" />
          <div>Cosmic Empires</div>
        </Link>
        <div className="flex-1 flex justify-center items-center">
          <Show when="signed-in" treatPendingAsSignedOut={true}>
            <Link to="/games">Games</Link>
          </Show>
        </div>
        <div className="flex-1 flex gap-2 text-2xl flex justify-end">
          <Show when="signed-out" treatPendingAsSignedOut={true}>
            <SignInButton />
            <SignUpButton />
          </Show>
          <Show when="signed-in" treatPendingAsSignedOut={true}>
            <UserButton />
          </Show>
        </div>
      </header>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
