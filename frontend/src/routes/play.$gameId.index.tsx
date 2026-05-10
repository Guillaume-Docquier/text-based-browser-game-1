import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { StarMapPlaceholder } from "./play.$gameId.map.tsx"

export const Route = createFileRoute("/play/$gameId/")({
  component: PlayGameIndex,
})

function PlayGameIndex(): ReactElement {
  return <StarMapPlaceholder />
}
