import { createFileRoute } from "@tanstack/react-router"
import { privateRoute } from "../privateRoute.ts"

export const Route = createFileRoute("/_game")({
  beforeLoad: privateRoute,
})
