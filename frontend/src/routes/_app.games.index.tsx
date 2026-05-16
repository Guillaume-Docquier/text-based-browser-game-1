import { createFileRoute } from "@tanstack/react-router"
import { GamesPage } from "../features/games/pages/GamesPage.tsx"

export const Route = createFileRoute("/_app/games/")({
  component: GamesPage,
})
