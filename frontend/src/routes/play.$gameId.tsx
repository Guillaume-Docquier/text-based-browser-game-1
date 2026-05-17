import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { PlayLayoutPage } from "../features/play/PlayLayoutPage.tsx"
import { privateRoute } from "../privateRoute.ts"
import type { ReactElement } from "react"

const paramsSchema = z.object({
  gameId: z.coerce.number(),
})

export const Route = createFileRoute("/play/$gameId")({
  component: PlayGameLayoutRoute,
  beforeLoad: privateRoute,
  params: { parse: (params) => paramsSchema.parse(params) },
  onError: (error) => {
    if (error?.routerCode === "PARSE_PARAMS") {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- That's how tanstack works
      throw redirect({ to: "/" })
    }
  },
})

function PlayGameLayoutRoute(): ReactElement {
  const { gameId } = Route.useParams()
  return <PlayLayoutPage gameId={gameId} />
}
