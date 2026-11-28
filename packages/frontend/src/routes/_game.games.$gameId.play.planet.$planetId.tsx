import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { PlanetIdSchema } from "shared/domain/world/planets/PlanetId.ts"
import { PlanetPage } from "@/features/play/planets/PlanetPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/planet/$planetId")({
  params: { parse: ({ planetId }) => ({ planetId: PlanetIdSchema.parse(planetId) }) },
  component: PlanetRoute,
})

function PlanetRoute(): ReactElement {
  const { planetId } = Route.useParams()
  return <PlanetPage planetId={planetId} />
}
