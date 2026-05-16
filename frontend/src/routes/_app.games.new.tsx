import { createFileRoute } from "@tanstack/react-router"
import { CreateGamePage } from "../features/games/pages/CreateGamePage.tsx"
import { privateRoute } from "../privateRoute.ts"

export const Route = createFileRoute("/_app/games/new")({
  component: CreateGamePage,
  beforeLoad: privateRoute,
})
