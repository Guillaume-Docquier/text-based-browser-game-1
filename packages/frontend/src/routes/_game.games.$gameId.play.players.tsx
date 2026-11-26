import { createFileRoute } from "@tanstack/react-router"
import { PlayersPage } from "@/features/play/players/PlayersPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/players")({
  component: PlayersPage,
})
