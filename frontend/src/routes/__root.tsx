import { Outlet, createRootRoute, Link } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { ReactElement } from "react"
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react"
import { UserSearch } from "lucide-react"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent(): ReactElement {
  return (
    <>
      <header className="h-16 items-center bg-surface-100 p-3 flex justify-between border-b border-primary-400 text-xl">
        <div className="flex-1 h-full">
          <Link to="/" className="h-full flex items-center gap-2 text-2xl font-bold">
            <img src="src/assets/logo.png" alt="logo" className="h-full" />
            <div>Cosmic Empires</div>
          </Link>
        </div>
        <div className="flex-1 flex justify-center">
          <Link to="/games" className="flex items-center font-semibold gap-1">
            <UserSearch />
            <div>Games</div>
          </Link>
        </div>
        <div className="flex-1 flex gap-2 justify-end">
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
