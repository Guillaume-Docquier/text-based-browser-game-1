import type { PlanetId } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { z } from "zod"
import { GalaxyPage } from "@/features/play/galaxy/GalaxyPage.tsx"

const GalaxySearchSchema = z.object({
  planetId: z
    .number()
    .transform(branded<PlanetId>)
    .exactOptional(),
})

export const Route = createFileRoute("/_game/games/$gameId/play/galaxy")({
  component: GalaxyRoute,
  validateSearch: GalaxySearchSchema,
})

function GalaxyRoute(): ReactElement {
  const { planetId } = Route.useSearch()
  return <GalaxyPage initialPlanetId={planetId} />
}
