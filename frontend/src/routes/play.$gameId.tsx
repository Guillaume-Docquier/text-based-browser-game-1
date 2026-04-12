import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { z } from "zod"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useQuery } from "@tanstack/react-query"

const paramsSchema = z.object({
  gameId: z.coerce.number(),
})

export const Route = createFileRoute("/play/$gameId")({
  component: GameClient,
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

function GameClient(): ReactElement {
  const { gameId } = Route.useParams()
  const backendApiClient = useBackendApiClient()
  const gameStateQuery = useQuery(backendApiClient.gameStates.getById.queryOptions({ gameId }))

  return <div>{JSON.stringify(gameStateQuery.data?.gameState, null, 2)}</div>
}
