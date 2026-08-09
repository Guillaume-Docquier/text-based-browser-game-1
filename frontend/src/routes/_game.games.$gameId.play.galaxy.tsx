import { createFileRoute } from "@tanstack/react-router"
import { GalaxyPage } from "@/features/play/galaxy/GalaxyPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/galaxy")({
  component: GalaxyPage,
})
