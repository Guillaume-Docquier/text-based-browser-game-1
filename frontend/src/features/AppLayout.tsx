import type { ReactElement } from "react"
import { Link, Outlet } from "@tanstack/react-router"
import logo from "../assets/logo.png"
import { Separator } from "../components/separator.tsx"
import { Button } from "../components/button.tsx"
import { Rocket, UserSearch } from "lucide-react"
import { Show, UserButton } from "@clerk/react"

export function AppLayout(): ReactElement {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Cosmic Empires logo" className="h-10 w-10 rounded-2xl object-cover shadow-sm ring-1 ring-border/60" />
            <div className="min-w-0">
              <div className="font-heading text-lg font-semibold tracking-tight sm:text-xl">Cosmic Empires</div>
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Persistent galactic strategy</div>
            </div>
          </Link>
          <Separator orientation="vertical" className="hidden h-8 md:block" />
          <nav className="flex flex-1 items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/" activeProps={{ className: "bg-muted text-foreground" }}>
                <Rocket className="size-4" />
                Home
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/games" activeProps={{ className: "bg-muted text-foreground" }}>
                <UserSearch className="size-4" />
                Games
              </Link>
            </Button>
          </nav>
          <div className="flex items-center gap-2">
            <Show when="signed-out" treatPendingAsSignedOut={true}>
              <Button asChild variant="ghost" size="sm">
                <Link to="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/sign-up">Sign up</Link>
              </Button>
            </Show>
            <Show when="signed-in" treatPendingAsSignedOut={true}>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>
      <main className="relative mx-auto flex w-full max-w-7xl justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
        <Separator className="bg-border/60" />
      </div>
    </div>
  )
}
