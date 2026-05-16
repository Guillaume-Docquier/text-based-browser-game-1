import { createFileRoute } from "@tanstack/react-router"
import { PlayGameActionsPage } from "../features/play/pages/PlayGameActionsPage.tsx"

export const Route = createFileRoute("/play/$gameId/actions")({
  component: PlayGameActionsRoute,
})

function PlayGameActionsRoute() {
  const { gameId } = Route.useParams()
  return <PlayGameActionsPage gameId={gameId} />
}
