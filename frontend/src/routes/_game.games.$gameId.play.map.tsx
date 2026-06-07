import { createFileRoute } from "@tanstack/react-router"
import { MapPage } from "../features/play/MapPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/map")({
  component: MapPage,
})
