import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { z } from "zod"
import { CreateGamePage } from "@/features/games/CreateGamePage.tsx"
import { privateRoute } from "@/privateRoute.ts"

const CreateGameSearchSchema = z.object({
  mapGenerationSeed: z.number().exactOptional(),
})

export const Route = createFileRoute("/_site/games/create")({
  component: CreateGameRoute,
  beforeLoad: privateRoute,
  validateSearch: CreateGameSearchSchema,
})

function CreateGameRoute(): ReactElement {
  const { mapGenerationSeed } = Route.useSearch()
  return <CreateGamePage mapGenerationSeed={mapGenerationSeed} />
}
