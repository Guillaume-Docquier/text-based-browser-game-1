import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { PlayerActionsPage } from "@/features/play/PlayerActionsPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/actions")({
  component: PlayerActionsRoute,
})

function PlayerActionsRoute(): ReactElement {
  const { gameId } = Route.useParams()
  return <PlayerActionsPage gameId={gameId} />
}
