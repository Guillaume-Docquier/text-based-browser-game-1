import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
import { GameActionSelector, GameActionSelectorSkeleton } from "../../../components/play/GameActionSelector.tsx"
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert.tsx"
import { useBackendApiClient } from "../../../contexts/BackendApiClientContext.tsx"
import { useLogger } from "../../../contexts/LoggerContext.tsx"
import { usePlayGameContext } from "../../../contexts/PlayGameContext.tsx"

export function PlayGameActionsPage({ gameId }: { gameId: number }): ReactElement {
  const logger = useLogger()
  const { gameState } = usePlayGameContext()
  const backendApiClient = useBackendApiClient()
  const currentActionQuery = useQuery(backendApiClient.gamePlayerActions.getCurrentAction.queryOptions({ gameId }))

  if (currentActionQuery.isPending) {
    return <GameActionSelectorSkeleton />
  }

  if (currentActionQuery.isError) {
    logger.error("Could not fetch current action", { gameId, error: currentActionQuery.error.message })
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Could not load current action</AlertTitle>
        <AlertDescription>{currentActionQuery.error.message}</AlertDescription>
      </Alert>
    )
  }

  return <GameActionSelector gameId={gameId} gameState={gameState} currentAction={currentActionQuery.data.action} />
}
