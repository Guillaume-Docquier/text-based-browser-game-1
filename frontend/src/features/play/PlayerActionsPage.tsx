import type { GameId } from "@api-types"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "../../components/alert.tsx"
import { useBackendApiClient } from "../../lib/api/BackendApiClientContext.tsx"
import { useLogger } from "../../lib/LoggerContext.tsx"
import { GameActionSelector, GameActionSelectorSkeleton } from "./components/GameActionSelector.tsx"
import { usePlayGameContext } from "./PlayContext.tsx"

export function PlayerActionsPage({ gameId }: { gameId: GameId }): ReactElement {
  const logger = useLogger()
  const { playerView } = usePlayGameContext()
  const backendApiClient = useBackendApiClient()
  const currentActionQuery = useQuery(backendApiClient.gameplay.getCurrentAction.queryOptions({ gameId }))

  if (currentActionQuery.isPending) {
    return (
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <GameActionSelectorSkeleton />
      </div>
    )
  }

  if (currentActionQuery.isError) {
    logger.error("Could not fetch current action", { gameId, error: currentActionQuery.error.message })
    return (
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not load current action</AlertTitle>
          <AlertDescription>{currentActionQuery.error.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
      <GameActionSelector gameId={gameId} playerView={playerView} currentAction={currentActionQuery.data.action} />
    </div>
  )
}
