import type { GameId } from "@api-types"
import { AlertTriangle } from "lucide-react"
import type { ReactElement, ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { GameActionSelector, GameActionSelectorSkeleton } from "@/features/play/components/GameActionSelector.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useCurrentActionQuery } from "@/lib/api/useCurrentActionQuery.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"

function PlayerActionsContainer({ children }: { children: ReactNode }): ReactElement {
  return <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
}

export function PlayerActionsPage({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const { playerView } = usePlayGameContext()
  const currentActionQuery = useCurrentActionQuery(gameId)

  if (currentActionQuery.isPending) {
    return (
      <PlayerActionsContainer>
        <GameActionSelectorSkeleton />
      </PlayerActionsContainer>
    )
  }

  if (currentActionQuery.isError) {
    logger.error("Could not fetch current action", { gameId, error: currentActionQuery.error.message })
    return (
      <PlayerActionsContainer>
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not load current action</AlertTitle>
          <AlertDescription>{currentActionQuery.error.message}</AlertDescription>
        </Alert>
      </PlayerActionsContainer>
    )
  }

  return (
    <PlayerActionsContainer>
      <GameActionSelector gameId={gameId} playerView={playerView} currentAction={currentActionQuery.data.action} />
    </PlayerActionsContainer>
  )
}
