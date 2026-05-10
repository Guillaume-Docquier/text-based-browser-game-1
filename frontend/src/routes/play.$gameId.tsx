import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Navigate, Outlet, redirect } from "@tanstack/react-router"
import { createContext, type ReactElement, useContext } from "react"
import { z } from "zod"
import type * as ApiTypes from "@api-types"
import { GameLayout, GameLayoutSkeleton } from "../components/GameLayout.tsx"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useLogger } from "../contexts/LoggerContext.tsx"
import { privateRoute } from "../privateRoute.ts"

export type PlayGameState = {
  tick: number
  nextTickAt: string | Date
  resources: {
    money: number
  }
}

type PlayGameContextValue = {
  game: ApiTypes.GameSummary
  gameState: PlayGameState
}

const PlayGameContext = createContext<PlayGameContextValue | undefined>(undefined)

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

export function usePlayGameContext(): PlayGameContextValue {
  const context = useContext(PlayGameContext)

  if (context === undefined) {
    throw new Error("usePlayGameContext must be used under the play game route")
  }

  return context
}

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
    <PlayGameContext.Provider value={context}>
      <GameLayout game={context.game} gameState={context.gameState}>
        <Outlet />
      </GameLayout>
    </PlayGameContext.Provider>
  )
}
