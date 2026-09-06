import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { FleetsPage } from "@/features/play/FleetsPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/fleets")({
  component: FleetsRoute,
})

function FleetsRoute(): ReactElement {
  return <FleetsPage />
}
