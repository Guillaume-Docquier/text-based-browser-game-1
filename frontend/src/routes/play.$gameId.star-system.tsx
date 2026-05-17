import { createFileRoute } from "@tanstack/react-router"
import { StarSystemPage } from "../features/play/StarSystemPage.tsx"

export const Route = createFileRoute("/play/$gameId/star-system")({
  component: StarSystemPage,
})
