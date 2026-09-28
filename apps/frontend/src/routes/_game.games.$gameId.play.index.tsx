import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_game/games/$gameId/play/")({
  beforeLoad: ({ params }) => {
    // oxlint-disable-next-line typescript/only-throw-error -- That's how tanstack works
    throw redirect({ to: "/games/$gameId/play/galaxy", params, replace: true })
  },
})
