import { Link } from "@tanstack/react-router"
import { ListChecks, Map, type LucideIcon } from "lucide-react"
import type { ReactElement } from "react"
import type { FileRouteTypes } from "../../routeTree.gen"
import logo from "../../assets/logo.png"

type GameSideNavLink = {
  to: Extract<FileRouteTypes["to"], `/play/$gameId${string}`>
  Icon: LucideIcon
  label: string
}

const gameSideNavLinks: readonly GameSideNavLink[] = [
  { to: "/play/$gameId/star-system", Icon: Map, label: "Star System" },
  { to: "/play/$gameId/actions", Icon: ListChecks, label: "Actions" },
]

export function GameSideNav({ gameId }: { gameId: number }): ReactElement {
  const linkClassName =
    "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
  const activeClassName = "bg-muted text-foreground"

  return (
    <aside className="border-b border-border/70 bg-card/40 lg:w-56 lg:border-r lg:border-b-0">
      <Link
        to="/"
        aria-label="Return to home"
        className="flex min-h-24 items-center gap-3 border-b border-border/70 px-3 py-4 transition-colors hover:bg-muted/40 lg:px-4"
      >
        <img src={logo} alt="Cosmic Empires logo" className="h-10 w-10 rounded-2xl object-cover shadow-sm ring-1 ring-border/60" />
        <div className="min-w-0">
          <div className="truncate font-heading text-base font-semibold text-foreground">Cosmic Empires</div>
          <div className="truncate text-xs text-muted-foreground">Back to home</div>
        </div>
      </Link>
      <nav className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-visible lg:p-4" aria-label="Game navigation">
        <div className="mb-1 hidden text-xs font-medium text-muted-foreground uppercase lg:block">Play</div>
        {gameSideNavLinks.map(({ to, Icon, label }) => (
          <Link key={to} to={to} params={{ gameId }} className={linkClassName} activeProps={{ className: activeClassName }}>
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
