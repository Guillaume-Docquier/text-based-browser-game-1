import { createFileRoute } from "@tanstack/react-router"
import type { ReactElement } from "react"
import { z } from "zod"
import { CreateGamePage } from "@/features/games/CreateGamePage.tsx"
import { privateRoute } from "@/privateRoute.ts"

const CreateGameSearch = z.object({
  seed: z.number().exactOptional(),
})

export const Route = createFileRoute("/_site/games/create")({
  component: CreateGameRoute,
  beforeLoad: privateRoute,
  validateSearch: CreateGameSearch,
})

function CreateGameRoute(): ReactElement {
  const { seed } = Route.useSearch()
  return <CreateGamePage seed={seed} />
}
