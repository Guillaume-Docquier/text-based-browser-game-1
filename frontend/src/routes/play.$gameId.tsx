import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { PlayGameLayoutPage } from "../features/play/pages/PlayGameLayoutPage.tsx"
import { privateRoute } from "../privateRoute.ts"

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

function PlayGameLayoutRoute() {
  const { gameId } = Route.useParams()
  return <PlayGameLayoutPage gameId={gameId} />
}
