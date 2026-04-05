import { Outlet, createRootRouteWithContext, Link } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import type { ReactElement } from "react"
import { Show, UserButton, type useAuth } from "@clerk/react"
import { UserSearch } from "lucide-react"
import logo from "../assets/logo.png"

export interface RouterContext {
  auth: ReturnType<typeof useAuth>
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent(): ReactElement {
  return (
    <>
      <header className="h-16 items-center bg-surface-100 p-3 flex justify-between border-b border-primary-400 text-xl">
        <div className="flex-1 h-full">
          <Link to="/" className="h-full flex items-center gap-2 text-2xl font-bold">
            <img src={logo} alt="logo" className="h-full" />
            <div>Cosmic Empires</div>
          </Link>
        </div>
        <div className="flex-1 flex justify-center">
          <Link to="/games" className="[&.active]:text-primary-200 flex items-center font-semibold gap-1">
            <UserSearch />
            <div>Games</div>
          </Link>
        </div>
        <div className="flex-1 flex gap-2 justify-end">
          <Show when="signed-out" treatPendingAsSignedOut={true}>
            <Link to="/sign-in">Sign in</Link>
            <Link to="/sign-up">Sign up</Link>
          </Show>
          <Show when="signed-in" treatPendingAsSignedOut={true}>
            <UserButton />
          </Show>
        </div>
      </header>
      <div className="flex justify-center p-8">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </>
  )
}
