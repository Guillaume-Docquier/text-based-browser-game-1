import type { Lobby, PlayerView } from "@api-types"
import type { ReactElement, ReactNode } from "react"
import { Skeleton } from "../../../components/skeleton.tsx"
import { GameSideNav } from "./GameSideNav.tsx"
import { GameTopBar } from "./GameTopBar.tsx"

export function GameLayout({ game, playerView, children }: { game: Lobby; playerView: PlayerView; children: ReactNode }): ReactElement {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-hidden border border-border/70 bg-background/65 lg:flex-row">
      <GameSideNav gameId={game.id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <GameTopBar game={game} playerView={playerView} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

export function GameLayoutSkeleton(): ReactElement {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-hidden border border-border/70 bg-background/65 lg:flex-row">
      <aside className="border-b border-border/70 bg-card/40 lg:w-56 lg:border-r lg:border-b-0">
        <div className="flex min-h-24 items-center gap-3 border-b border-border/70 px-3 py-4 lg:px-4">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex gap-2 p-3 lg:flex-col lg:p-4">
          <Skeleton className="h-10 w-32 lg:w-full" />
          <Skeleton className="h-10 w-32 lg:w-full" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-24 flex-col justify-center border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-64 max-w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-11 w-40" />
            </div>
          </div>
        </div>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="space-y-5">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-80 w-full" />
          </div>
        </main>
      </div>
    </div>
  )
}
