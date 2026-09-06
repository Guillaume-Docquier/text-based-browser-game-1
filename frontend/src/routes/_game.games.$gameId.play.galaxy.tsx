import type { Planet } from "@api-types"
import { branded } from "@guillaume-docquier/tools-ts"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { GalaxyPage } from "@/features/play/galaxy/GalaxyPage.tsx"

const GalaxySearch = z.object({
  planetId: z.coerce
    .number()
    .int()
    .optional()
    .transform((planetId) => (planetId === undefined ? undefined : branded<Planet["id"]>(planetId))),
})

export const Route = createFileRoute("/_game/games/$gameId/play/galaxy")({
  component: GalaxyPage,
  validateSearch: GalaxySearch,
})
