import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_game/games/$gameId/play/")({
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- That's how tanstack works
    throw redirect({ to: "/games/$gameId/play/star-system", params, replace: true })
  },
})
