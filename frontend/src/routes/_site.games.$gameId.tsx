import type { GameId } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { z } from "zod"
import { LobbyPage } from "@/features/games/LobbyPage.tsx"

const paramsSchema = z.object({
  gameId: z.coerce.number().transform(branded<GameId>),
})

export const Route = createFileRoute("/_site/games/$gameId")({
  component: LobbyRoute,
  params: {
    parse: (params) => paramsSchema.parse(params),
  },
  onError: (error) => {
    if (error?.routerCode === "PARSE_PARAMS") {
      // oxlint-disable-next-line typescript/only-throw-error -- That's how tanstack works
      throw redirect({ to: "/games" })
    }
  },
})

function LobbyRoute(): ReactElement {
  const { gameId } = Route.useParams()
  return <LobbyPage gameId={gameId} />
}
