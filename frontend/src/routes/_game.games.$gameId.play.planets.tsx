import { createFileRoute } from "@tanstack/react-router"
import { PlanetsPage } from "@/features/play/planets/PlanetsPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/planets")({
  component: PlanetsPage,
})
