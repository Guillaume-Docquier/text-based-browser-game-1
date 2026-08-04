import type * as ApiTypes from "@api-types"
import type { Enumify } from "@guillaume-docquier/tools-ts"
import { type ReactElement, useState } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { Input } from "@/components/input.tsx"
import { Label } from "@/components/label.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { PageHeader } from "@/features/PageHeader.tsx"
import { useCreateGameMutation } from "@/lib/api/useCreateGameMutation.ts"
import { useLobbyCreationSettingsQuery } from "@/lib/api/useLobbyCreationSettingsQuery.ts"

type TurnIntervalUnit = Enumify<typeof TurnIntervalUnit>
const TurnIntervalUnit = {
  days: "days",
  hours: "hours",
  minutes: "minutes",
} as const

export function CreateGamePage(): ReactElement {
  const creationSettingsQuery = useLobbyCreationSettingsQuery()

  if (creationSettingsQuery.isPending || creationSettingsQuery.isFetching) {
    return <CreateGameLoadingState />
  }

  if (creationSettingsQuery.isError) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <PageHeader title="Create a new game" description="The game creation settings could not be loaded." />
      </div>
    )
  }

  return <CreateGameForm creationSettings={creationSettingsQuery.data} />
}

function CreateGameForm({ creationSettings }: { creationSettings: ApiTypes.LobbyCreationSettings }): ReactElement {
  const [name, setName] = useState("")
  const [nbSeats, setNbSeats] = useState(5)
  const [turnIntervalMultiplier, setTurnIntervalMultiplier] = useState(1)
  const [turnIntervalUnit, setTurnIntervalUnit] = useState<TurnIntervalUnit>(TurnIntervalUnit.days)
  const createGame = useCreateGameMutation()
  const isCreateDisabled = name === "" || nbSeats < 2 || nbSeats > creationSettings.maxNbSeats

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Create a new game" description="Configure the lobby and the star map players will explore." />

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Set the lobby name, player capacity, and turn cadence.</CardDescription>
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
              min={2}
              max={creationSettings.maxNbSeats}
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
                aria-label="Turn length"
                type="number"
                value={turnIntervalMultiplier}
                onChange={(event) => {
                  setTurnIntervalMultiplier(parseInt(event.target.value))
                }}
              />
              <Select
                value={turnIntervalUnit}
                onValueChange={(value) => {
                  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Maybe we should parse, but this will be okay
                  setTurnIntervalUnit(value as TurnIntervalUnit)
                }}
              >
                <SelectTrigger aria-label="Turn length unit" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TurnIntervalUnit).map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button
          disabled={isCreateDisabled || createGame.isPending}
          onClick={() => {
            createGame.mutate({
              configuration: {
                name,
                nbSeats,
                turnIntervalSeconds: Temporal.Duration.from({ [turnIntervalUnit]: turnIntervalMultiplier }).total("seconds"),
              },
            })
          }}
        >
          {createGame.isPending ? "Creating..." : "Create"}
        </Button>
      </div>
    </div>
  )
}

function CreateGameLoadingState(): ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Create a new game" description="Loading game creation settings." />
      <Skeleton className="h-64 w-full rounded-4xl" />
      <Skeleton className="h-150 w-full rounded-4xl" />
    </div>
  )
}
