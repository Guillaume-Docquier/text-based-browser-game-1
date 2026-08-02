import type { GameId } from "@api-types"
import { AlertTriangle } from "lucide-react"
import type { ReactElement, ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { ActionSelector, ActionSelectorSkeleton } from "@/features/play/components/ActionSelector.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useCurrentActionQuery } from "@/lib/api/useCurrentActionQuery.ts"
import { useLogger } from "@/lib/LoggerContext.tsx"

function ActionsContainer({ children }: { children: ReactNode }): ReactElement {
  return <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</div>
}

export function ActionsPage({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const { playerView } = usePlayGameContext()
  const currentActionQuery = useCurrentActionQuery(gameId)

  if (currentActionQuery.isPending) {
    return (
      <ActionsContainer>
        <ActionSelectorSkeleton />
      </ActionsContainer>
    )
  }

  if (currentActionQuery.isError) {
    logger.error("Could not fetch current action", { gameId, error: currentActionQuery.error.message })
    return (
      <ActionsContainer>
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not load current action</AlertTitle>
          <AlertDescription>{currentActionQuery.error.message}</AlertDescription>
        </Alert>
      </ActionsContainer>
    )
  }

  return (
    <ActionsContainer>
      <ActionSelector gameId={gameId} playerView={playerView} currentAction={currentActionQuery.data.action} />
    </ActionsContainer>
  )
}
