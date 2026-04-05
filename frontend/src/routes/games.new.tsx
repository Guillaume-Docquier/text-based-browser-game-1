import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type ReactElement, useState } from "react"
import { TextInput } from "../design-system/TextInput.tsx"
import { NumberInput } from "../design-system/NumberInput.tsx"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"
import { useMutation } from "@tanstack/react-query"
import { privateRoute } from "../privateRoute.ts"

export const Route = createFileRoute("/games/new")({
  component: CreateGame,
  beforeLoad: privateRoute,
})

function CreateGame(): ReactElement {
  const [name, setName] = useState("")
  const [maxPlayerCount, setMaxPlayerCount] = useState(5)
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
          <NumberInput value={maxPlayerCount} integer onChange={setMaxPlayerCount} />
        </div>
      </div>
      <button
        className="disabled:bg-primary-500 disabled:text-surface-300 disabled:cursor-auto self-start font-semibold uppercase bg-primary-50 text-dark-50 py-3 px-5 rounded-xl cursor-pointer"
        disabled={name === "" || maxPlayerCount < 2}
        onClick={() => {
          createGame.mutate(
            { newGame: { name, maxPlayerCount } },
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
