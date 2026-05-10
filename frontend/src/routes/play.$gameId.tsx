import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Navigate, Outlet, redirect } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { z } from "zod"
import { GameLayout, GameLayoutSkeleton } from "../components/GameLayout.tsx"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useLogger } from "../contexts/LoggerContext.tsx"
import { PlayGameContextProvider, type PlayGameContextValue } from "../contexts/PlayGameContext.tsx"
import { privateRoute } from "../privateRoute.ts"

const paramsSchema = z.object({
  gameId: z.coerce.number(),
})

export const Route = createFileRoute("/play/$gameId")({
  component: PlayGameLayout,
  beforeLoad: privateRoute,
  params: {
    parse: (params) => paramsSchema.parse(params),
  },
  onError: (error) => {
    if (error?.routerCode === "PARSE_PARAMS") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- This how tanstack works
      throw redirect({ to: "/" })
    }
  },
})

function PlayGameLayout(): ReactElement {
  const logger = useLogger()
  const { gameId } = Route.useParams()
  const backendApiClient = useBackendApiClient()
  const gameQuery = useQuery(backendApiClient.games.getSummaryById.queryOptions({ gameId }))
  const gameStateQuery = useQuery(backendApiClient.gameStates.getById.queryOptions({ gameId }))

  if (gameQuery.isPending || gameStateQuery.isPending) {
    return <GameLayoutSkeleton />
  }

  if (gameQuery.isError) {
    logger.error("Could not fetch game", { gameId, error: gameQuery.error.message })
    return <Navigate to="/games" />
  }

  if (gameStateQuery.isError) {
    logger.error("Could not fetch game state", { gameId, error: gameStateQuery.error.message })
    return <Navigate to="/games" />
  }

  const context: PlayGameContextValue = {
    game: gameQuery.data.game,
    gameState: gameStateQuery.data.gameState,
  }

  return (
    <PlayGameContextProvider value={context}>
      <GameLayout game={context.game} gameState={context.gameState}>
        <Outlet />
      </GameLayout>
    </PlayGameContextProvider>
  )
}
