import type { Enumify } from "@guillaume-docquier/tools-ts"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { type ReactElement, useState } from "react"
import { Button } from "../../components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card.tsx"
import { Input } from "../../components/input.tsx"
import { Label } from "../../components/label.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/select.tsx"
import { useBackendApiClient } from "../../lib/api/BackendApiClientContext.tsx"
import { PageHeader } from "../PageHeader.tsx"

type TickIntervalUnit = Enumify<typeof TickIntervalUnit>
const TickIntervalUnit = {
  days: "days",
  hours: "hours",
  minutes: "minutes",
} as const

export function CreateGamePage(): ReactElement {
  const [name, setName] = useState("")
  const [nbSeats, setNbSeats] = useState(5)
  const [tickIntervalMultiplier, setTickIntervalMultiplier] = useState(1)
  const [tickIntervalUnit, setTickIntervalUnit] = useState<TickIntervalUnit>(TickIntervalUnit.days)
  const navigate = useNavigate()
  const backendApiClient = useBackendApiClient()
  const createGame = useMutation(backendApiClient.games.create.mutationOptions())
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
                  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Maybe we should parse, but this will be okay
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
                    settings: {
                      name,
                      nbSeats,
                      tickIntervalSeconds: Temporal.Duration.from({ [tickIntervalUnit]: tickIntervalMultiplier }).total("seconds"),
                    },
                  },
                  {
                    onSuccess: ({ createdGameId }) => {
                      void navigate({ to: "/games/$gameId", params: { gameId: createdGameId } })
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
