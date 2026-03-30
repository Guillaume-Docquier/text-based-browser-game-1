import type { ReactElement } from "react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/games")({
  component: Games,
})

function Games(): ReactElement {
  return (
    <div>
      <div>These are all the games</div>
    </div>
  )
}
