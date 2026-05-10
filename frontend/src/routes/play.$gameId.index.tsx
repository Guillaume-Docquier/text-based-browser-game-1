import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { GameStarMap } from "../components/GameStarMap.tsx"

export const Route = createFileRoute("/play/$gameId/")({
  component: PlayGameIndex,
})

function PlayGameIndex(): ReactElement {
  return <GameStarMap />
}
