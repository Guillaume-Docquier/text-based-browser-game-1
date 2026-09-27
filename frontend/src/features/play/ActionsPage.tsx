import type { GameId } from "@api-types"
import type { ReactElement } from "react"
import { ActionSelector } from "@/features/play/components/ActionSelector.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"

export function ActionsPage({ gameId }: { gameId: GameId }): ReactElement {
  const { game, playerView } = usePlayGameContext()

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <Header />
      <ActionSelector gameId={gameId} playerView={playerView} players={game.players} />
    </div>
  )
}

function Header(): ReactElement {
  return (
    <div className="mb-5">
      <h2 className="font-heading text-2xl font-semibold text-foreground">Actions</h2>
    </div>
  )
}
