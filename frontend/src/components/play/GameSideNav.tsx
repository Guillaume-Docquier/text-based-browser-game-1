import { Link } from "@tanstack/react-router"
import { ListChecks, Map } from "lucide-react"
import type { ReactElement } from "react"
import logo from "../../assets/logo.png"

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
        <Link to="/play/$gameId/star-system" params={{ gameId }} className={linkClassName} activeProps={{ className: activeClassName }}>
          <Map className="size-4" />
          Star System
        </Link>
        <Link to="/play/$gameId/actions" params={{ gameId }} className={linkClassName} activeProps={{ className: activeClassName }}>
          <ListChecks className="size-4" />
          Actions
        </Link>
      </nav>
    </aside>
  )
}
