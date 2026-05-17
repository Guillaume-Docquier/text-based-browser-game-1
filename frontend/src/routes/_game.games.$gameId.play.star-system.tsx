import { createFileRoute } from "@tanstack/react-router"
import { StarSystemPage } from "../features/play/StarSystemPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/star-system")({
  component: StarSystemPage,
})
