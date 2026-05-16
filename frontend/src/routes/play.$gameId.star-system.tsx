import { createFileRoute } from "@tanstack/react-router"
import { PlayGameStarSystemPage } from "../features/play/pages/PlayGameStarSystemPage.tsx"

export const Route = createFileRoute("/play/$gameId/star-system")({
  component: PlayGameStarSystemPage,
})
