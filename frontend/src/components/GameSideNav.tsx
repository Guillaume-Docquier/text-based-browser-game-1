import { Link, useRouterState } from "@tanstack/react-router"
import { ListChecks, Map } from "lucide-react"
import type { ReactElement } from "react"
import { cn } from "../lib/cn.ts"

export function GameSideNav({ gameId }: { gameId: number }): ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const rootPath = `/play/${gameId}`
  const isStarMapActive = pathname === rootPath || pathname === `${rootPath}/` || pathname === `${rootPath}/star-system`
  const isActionsActive = pathname === `${rootPath}/actions`
  const linkClassName =
    "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
  const activeClassName = "bg-muted text-foreground"

  return (
    <aside className="border-b border-border/70 bg-card/40 p-3 lg:w-56 lg:border-r lg:border-b-0 lg:p-4">
      <div className="mb-3 hidden text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase lg:block">Play</div>
      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Game navigation">
        <Link
          to="/play/$gameId/star-system"
          params={{ gameId }}
          aria-current={isStarMapActive ? "page" : undefined}
          className={cn(linkClassName, isStarMapActive && activeClassName)}
        >
          <Map className="size-4" />
          Star System
        </Link>
        <Link
          to="/play/$gameId/actions"
          params={{ gameId }}
          aria-current={isActionsActive ? "page" : undefined}
          className={cn(linkClassName, isActionsActive && activeClassName)}
        >
          <ListChecks className="size-4" />
          Actions
        </Link>
      </nav>
    </aside>
  )
}
