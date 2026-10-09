import { createFileRoute } from "@tanstack/react-router"
import { GameSummariesPage } from "@/features/games/GameSummariesPage.tsx"

export const Route = createFileRoute("/_site/games/")({
  component: GameSummariesPage,
})
