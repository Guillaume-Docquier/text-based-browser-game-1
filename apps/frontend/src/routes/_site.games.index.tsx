import { createFileRoute } from "@tanstack/react-router"
import { GameListingsPage } from "@/features/games/GameListingsPage.tsx"

export const Route = createFileRoute("/_site/games/")({
  component: GameListingsPage,
})
