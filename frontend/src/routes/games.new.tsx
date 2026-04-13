import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type ReactElement, useState } from "react"
import { TextInput } from "../design-system/TextInput.tsx"
import { NumberInput } from "../design-system/NumberInput.tsx"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useMutation } from "@tanstack/react-query"
import { privateRoute } from "../privateRoute.ts"
import type { Enumify } from "@guillaume-docquier/tools-ts"

type TickIntervalUnit = Enumify<typeof TickIntervalUnit>
const TickIntervalUnit = {
  days: "days",
  hours: "hours",
  minutes: "minutes",
} as const

export const Route = createFileRoute("/games/new")({
  component: CreateGame,
  beforeLoad: privateRoute,
})

function CreateGame(): ReactElement {
  const [name, setName] = useState("")
  const [nbSeats, setNbSeats] = useState(5)
  const [tickIntervalMultiplier, setTickIntervalMultiplier] = useState(1)
  const [tickIntervalUnit, setTickIntervalUnit] = useState<TickIntervalUnit>(TickIntervalUnit.days)
  const navigate = useNavigate()
  const backendApiClient = useBackendApiClient()
  const createGame = useMutation(backendApiClient.games.create.mutationOptions())

  return (
    <div className="p-8 flex flex-col gap-4">
      <div className="text-2xl">Create a new game</div>
      <div className="flex flex-row gap-4">
        <div>
          <div>Game name</div>
          <TextInput value={name} onChange={setName} />
        </div>
        <div>
          <div>Max number of players</div>
          <NumberInput value={nbSeats} integer onChange={setNbSeats} />
        </div>
        <div>
          <div>Turn length</div>
          <div className="flex flex-row gap-2">
            <NumberInput value={tickIntervalMultiplier} integer onChange={setTickIntervalMultiplier} />
            <select
              value={tickIntervalUnit}
              onChange={(event) => {
                setTickIntervalUnit(event.target.value as TickIntervalUnit)
              }}
            >
              {Object.values(TickIntervalUnit).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <button
        className="disabled:bg-primary-500 disabled:text-surface-300 disabled:cursor-auto self-start font-semibold uppercase bg-primary-50 text-dark-50 py-3 px-5 rounded-xl cursor-pointer"
        disabled={name === "" || nbSeats < 2}
        onClick={() => {
          createGame.mutate(
            {
              newGame: {
                name,
                nbSeats,
                tickIntervalSeconds: Temporal.Duration.from({ [tickIntervalUnit]: tickIntervalMultiplier }).total("seconds"),
              },
            },
            {
              onSuccess: ({ newGame }) => {
                void navigate({ to: "/games/$gameId", params: { gameId: newGame.id } })
              },
            },
          )
        }}
      >
        Create
      </button>
    </div>
  )
}
