import type { ReactElement, ReactNode } from "react"
import type * as ApiTypes from "@api-types"
import type { PlayGameState } from "../routes/play.$gameId.tsx"
import { GameSideNav } from "./GameSideNav.tsx"
import { GameTopBar } from "./GameTopBar.tsx"
import { Skeleton } from "./ui/skeleton.tsx"

export function GameLayout({
  game,
  gameState,
  children,
}: {
  game: ApiTypes.GameSummary
  gameState: PlayGameState
  children: ReactNode
}): ReactElement {
  return (
    <div className="flex min-h-[calc(100vh-11rem)] w-full flex-col overflow-hidden border border-border/70 bg-background/65 lg:flex-row">
      <GameSideNav gameId={game.id} />
      <div className="flex min-w-0 flex-1 flex-col">
        <GameTopBar game={game} gameState={gameState} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

export function GameLayoutSkeleton(): ReactElement {
  return (
    <div className="flex min-h-[calc(100vh-11rem)] w-full flex-col overflow-hidden border border-border/70 bg-background/65 lg:flex-row">
      <aside className="border-b border-border/70 p-4 lg:w-56 lg:border-r lg:border-b-0">
        <Skeleton className="mb-5 h-5 w-28" />
        <div className="flex gap-2 lg:flex-col">
          <Skeleton className="h-10 w-32 lg:w-full" />
          <Skeleton className="h-10 w-32 lg:w-full" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border/70 px-4 py-4 sm:px-6">
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
