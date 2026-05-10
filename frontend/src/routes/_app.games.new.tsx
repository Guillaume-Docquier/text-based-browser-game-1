import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { type ReactElement, useState } from "react"
import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { privateRoute } from "../privateRoute.ts"
import type { Enumify } from "@guillaume-docquier/tools-ts"
import { PageHeader } from "../components/PageHeader.tsx"
import { Button } from "../components/ui/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx"
import { Input } from "../components/ui/input.tsx"
import { Label } from "../components/ui/label.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx"
import { useBackendApiClient } from "../contexts/BackendApiClientContext.tsx"

type TickIntervalUnit = Enumify<typeof TickIntervalUnit>
type CreateGameInput = {
  newGame: {
    name: string
    nbSeats: number
    tickIntervalSeconds: number
  }
}
type CreateGameResult = {
  newGame: {
    id: number
  }
}
const TickIntervalUnit = {
  days: "days",
  hours: "hours",
  minutes: "minutes",
} as const

export const Route = createFileRoute("/_app/games/new")({
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
  const createGame = useMutation(
    backendApiClient.games.create.mutationOptions() as UseMutationOptions<CreateGameResult, Error, CreateGameInput>,
  )
  const isCreateDisabled = name === "" || nbSeats < 2

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Create a new game"
        description="Set the lobby name, seat count, and turn cadence. Submission behavior and validation are unchanged."
      />
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Lobby settings</CardTitle>
          <CardDescription>Invite players once the game is created, then start when the lobby is ready.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="game-name">Game name</Label>
            <Input
              id="game-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              placeholder="Galactic trade league"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nb-seats">Max number of players</Label>
            <Input
              id="nb-seats"
              type="number"
              value={nbSeats}
              onChange={(event) => {
                setNbSeats(parseInt(event.target.value))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Turn length</Label>
            <div className="flex gap-3">
              <Input
                type="number"
                value={tickIntervalMultiplier}
                onChange={(event) => {
                  setTickIntervalMultiplier(parseInt(event.target.value))
                }}
              />
              <Select
                value={tickIntervalUnit}
                onValueChange={(value) => {
                  setTickIntervalUnit(value as TickIntervalUnit)
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TickIntervalUnit).map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="md:col-span-2">
            <Button
              disabled={isCreateDisabled || createGame.isPending}
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
              {createGame.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
