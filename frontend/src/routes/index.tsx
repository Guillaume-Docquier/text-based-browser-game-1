import { type ReactElement } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index(): ReactElement {
  const backendApiClient = useBackendApiClient()
  const queryClient = useQueryClient()

  const tick = useQuery({
    queryKey: ["tick"],
    queryFn: async () => await backendApiClient.getTick(),
  })

  const incrementTick = useMutation({
    mutationFn: async () => {
      await backendApiClient.incrementTick()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tick"] })
    },
  })

  const hue = (((tick.data ?? 0) % 10000) / 10000) * 360

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold underline">Cosmic Empires</h1>
        <p>A deep text based strategy game where diplomacy is an option</p>
      </div>
      <button
        className="counter"
        style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
        onClick={() => {
          incrementTick.mutate()
        }}
      >
        Game tick is {tick.data ?? "unknown"}
      </button>
      <Link to="/about">Explore</Link>
    </>
  )
}
