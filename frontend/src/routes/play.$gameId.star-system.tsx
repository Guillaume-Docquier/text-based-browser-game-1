import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { GameStarMap } from "../components/GameStarMap.tsx"

export const Route = createFileRoute("/play/$gameId/star-system")({
  component: PlayGameMap,
})

function PlayGameMap(): ReactElement {
  return <GameStarMap />
}
