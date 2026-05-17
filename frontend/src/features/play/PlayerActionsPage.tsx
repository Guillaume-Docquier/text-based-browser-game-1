import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
import { GameActionSelector, GameActionSelectorSkeleton } from "./components/GameActionSelector.tsx"
import { Alert, AlertDescription, AlertTitle } from "../../components/alert.tsx"
import { useBackendApiClient } from "../../lib/api/BackendApiClientContext.tsx"
import { useLogger } from "../../lib/LoggerContext.tsx"
import { usePlayGameContext } from "./PlayContext.tsx"

export function PlayerActionsPage({ gameId }: { gameId: number }): ReactElement {
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
