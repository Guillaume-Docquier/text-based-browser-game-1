import { createFileRoute } from "@tanstack/react-router"
import { GamesBrowserPage } from "@/features/games/GamesBrowserPage.tsx"

export const Route = createFileRoute("/_site/games/")({
  component: GamesBrowserPage,
})
