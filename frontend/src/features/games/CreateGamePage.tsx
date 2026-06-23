import type * as ApiTypes from "@api-types"
import type { Enumify } from "@guillaume-docquier/tools-ts"
import { type ReactElement, useState } from "react"
import { Button } from "../../components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card.tsx"
import { Input } from "../../components/input.tsx"
import { Label } from "../../components/label.tsx"
import { RangeSlider } from "../../components/RangeSlider.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/select.tsx"
import { Skeleton } from "../../components/skeleton.tsx"
import { useCreateGameMutation } from "../../lib/api/useCreateGameMutation.ts"
import { useLobbyCreationSettingsQuery } from "../../lib/api/useLobbyCreationSettingsQuery.ts"
import { PageHeader } from "../PageHeader.tsx"
import { RANGE_SETTING_LABELS } from "./rangeSettingLabels.ts"

type TickIntervalUnit = Enumify<typeof TickIntervalUnit>
const TickIntervalUnit = {
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
  const [tickIntervalMultiplier, setTickIntervalMultiplier] = useState(1)
  const [tickIntervalUnit, setTickIntervalUnit] = useState<TickIntervalUnit>(TickIntervalUnit.days)
  const [starSystemGenerationSettings, setStarSystemGenerationSettings] = useState(creationSettings.defaultStarSystemGenerationSettings)
  const createGame = useCreateGameMutation()
  const isCreateDisabled = name === "" || nbSeats < 2

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
                <SelectTrigger aria-label="Turn length unit" className="w-40">
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
        </CardContent>
      </Card>

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Star map</CardTitle>
          <CardDescription>Choose a fixed value or a range for each generated feature.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8">
          {Object.entries(RANGE_SETTING_LABELS).map(([key, metadata]) => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.entries does not preserve the object's key type
            const settingKey = key as ApiTypes.RangeSettingKey

            return (
              <RangeSetting
                key={settingKey}
                metadata={metadata}
                value={starSystemGenerationSettings[settingKey]}
                limits={creationSettings.starSystemGenerationSettingsLimits[settingKey]}
                onChange={([min, max]) => {
                  setStarSystemGenerationSettings((currentSettings) => ({
                    ...currentSettings,
                    [settingKey]: {
                      ...currentSettings[settingKey],
                      min,
                      max,
                    },
                  }))
                }}
              />
            )
          })}
          <div className="space-y-2">
            <Label htmlFor="generation-seed">Generation seed</Label>
            <p className="text-sm text-muted-foreground">Games with the same settings and seed generate the same star map.</p>
            <Input
              id="generation-seed"
              type="number"
              min={creationSettings.starSystemGenerationSettingsLimits.seed.min}
              max={creationSettings.starSystemGenerationSettingsLimits.seed.max}
              step={1}
              value={starSystemGenerationSettings.seed}
              onChange={(event) => {
                setStarSystemGenerationSettings((currentSettings) => ({
                  ...currentSettings,
                  seed: Number(event.target.value),
                }))
              }}
            />
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
                tickIntervalSeconds: Temporal.Duration.from({ [tickIntervalUnit]: tickIntervalMultiplier }).total("seconds"),
                starSystemGenerationSettings,
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

function RangeSetting({
  metadata,
  value,
  limits,
  onChange,
}: {
  metadata: { label: string; description: string }
  value: ApiTypes.StarSystemGenerationSettings[ApiTypes.RangeSettingKey]
  limits: ApiTypes.StarSystemGenerationSettingsLimits[ApiTypes.RangeSettingKey]
  onChange: (value: [number, number]) => void
}): ReactElement {
  const step = limits.numericType === "integer" ? 1 : 0.01

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Label>{metadata.label}</Label>
          <p className="text-sm text-muted-foreground">{metadata.description}</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="min-w-12 rounded-full bg-muted px-3 py-1 text-center">{value.min}</span>
          <span className="text-muted-foreground">to</span>
          <span className="min-w-12 rounded-full bg-muted px-3 py-1 text-center">{value.max}</span>
        </div>
      </div>
      <RangeSlider
        min={limits.min}
        max={limits.max}
        step={step}
        value={[value.min, value.max]}
        thumbLabels={[`${metadata.label} minimum`, `${metadata.label} maximum`]}
        onValueChange={onChange}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{limits.min}</span>
        <span>{limits.max}</span>
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
