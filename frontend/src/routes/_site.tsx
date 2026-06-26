import { createFileRoute } from "@tanstack/react-router"
import { AppLayout } from "@/features/AppLayout.tsx"

export const Route = createFileRoute("/_site")({
  component: AppLayout,
})
