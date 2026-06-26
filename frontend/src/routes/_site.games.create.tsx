import { createFileRoute } from "@tanstack/react-router"
import { CreateGamePage } from "@/features/games/CreateGamePage.tsx"
import { privateRoute } from "@/privateRoute.ts"

export const Route = createFileRoute("/_site/games/create")({
  component: CreateGamePage,
  beforeLoad: privateRoute,
})
