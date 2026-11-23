import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { GameListingsPage } from "@/features/games/GameListingsPage.tsx"

export const Route = createFileRoute("/_site/games/")({
  component: GameListingsRoute,
})

function GameListingsRoute(): ReactElement {
  const { auth } = Route.useRouteContext()
  return <GameListingsPage isSignedIn={auth.isSignedIn === true} />
}
