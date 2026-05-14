import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/play/$gameId/")({
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- That's how tanstack works
    throw redirect({ to: "/play/$gameId/star-system", params, replace: true })
  },
})
