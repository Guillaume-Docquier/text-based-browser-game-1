import { createFileRoute } from "@tanstack/react-router"
import { FleetsPage } from "@/features/play/fleets/FleetsPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/fleets")({
  component: FleetsPage,
})
