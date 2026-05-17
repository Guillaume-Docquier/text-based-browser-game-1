import { createFileRoute } from "@tanstack/react-router"
import { GamesPage } from "../features/games/GamesPage.tsx"

export const Route = createFileRoute("/_app/games/")({
  component: GamesPage,
})
