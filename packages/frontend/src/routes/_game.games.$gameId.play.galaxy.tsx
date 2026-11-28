import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { PlanetIdSchema } from "shared/domain/world/planets/PlanetId.ts"
import { StarIdSchema } from "shared/domain/world/stars/StarId.ts"
import { z } from "zod"
import { GalaxyPage } from "@/features/play/galaxy/GalaxyPage.tsx"

export const Route = createFileRoute("/_game/games/$gameId/play/galaxy")({
  component: GalaxyRoute,
  validateSearch: z.object({ starId: StarIdSchema.exactOptional(), planetId: PlanetIdSchema.exactOptional() }),
  beforeLoad: ({ params, search }) => {
    if (search.planetId !== undefined) {
      return redirect({ to: "/games/$gameId/play/planet/$planetId", params: { ...params, planetId: search.planetId }, replace: true })
    }
  },
})

function GalaxyRoute(): ReactElement {
  const { starId } = Route.useSearch()
  return <GalaxyPage starId={starId} />
}
