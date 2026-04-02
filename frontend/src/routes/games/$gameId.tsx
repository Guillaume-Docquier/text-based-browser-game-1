import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ReactElement } from "react"

export const Route = createFileRoute("/games/$gameId")({
  component: GameLobby,
  params: {
    parse: (rawParams) => {
      const gameId = Number(rawParams.gameId)
      if (isNaN(gameId)) {
        throw new Error(`gameId '${rawParams.gameId}' is not a number`)
      }
      return { gameId }
    },
  },
  onError: (error) => {
    if (error?.routerCode === "PARSE_PARAMS") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- This how tanstack works
      throw redirect({ to: "/games" })
    }
  },
})

function GameLobby(): ReactElement {
  const { gameId } = Route.useParams()

  return <div>Hello {gameId}</div>
}
