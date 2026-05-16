import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "../features/home/pages/HomePage.tsx"

export const Route = createFileRoute("/_app/")({
  component: HomePage,
})
