import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { ActionsPage } from "@/features/play/ActionsPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/actions")({
  component: ActionsRoute,
})

function ActionsRoute(): ReactElement {
  const { gameId } = Route.useParams()
  return <ActionsPage gameId={gameId} />
}
