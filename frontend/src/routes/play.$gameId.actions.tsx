import { createFileRoute } from "@tanstack/react-router"
import { PlayerActionsPage } from "../features/play/PlayerActionsPage.tsx"
import type { ReactElement } from "react"

export const Route = createFileRoute("/play/$gameId/actions")({
  component: PlayGameActionsRoute,
})

function PlayGameActionsRoute(): ReactElement {
  const { gameId } = Route.useParams()
  return <PlayerActionsPage gameId={gameId} />
}
