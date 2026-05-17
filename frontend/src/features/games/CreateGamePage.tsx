import { useMutation, type UseMutationOptions } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { Enumify } from "@guillaume-docquier/tools-ts"
import { type ReactElement, useState } from "react"
import { PageHeader } from "../PageHeader.tsx"
import { Button } from "../../components/button.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card.tsx"
import { Input } from "../../components/input.tsx"
import { Label } from "../../components/label.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/select.tsx"
import { useBackendApiClient } from "../../lib/api/BackendApiClientContext.tsx"

type TickIntervalUnit = Enumify<typeof TickIntervalUnit>
type CreateGameInput = {
  newGame: {
    name: string
    nbSeats: number
    tickIntervalSeconds: number
    starSystemGenerationSettings: {
      planetDensity: RangeInput
      nbPlanets: RangeInput
      nbMoonsPerPlanet: RangeInput
      nbAsteroidBelts: RangeInput
      nbAsteroidsPerSector: RangeInput
      seed?: number
    }
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
type RangeInput = {
  min: number
  max: number
}

export function CreateGamePage(): ReactElement {
  const [name, setName] = useState("")
  const [nbSeats, setNbSeats] = useState(5)
  const [tickIntervalMultiplier, setTickIntervalMultiplier] = useState(1)
  const [tickIntervalUnit, setTickIntervalUnit] = useState<TickIntervalUnit>(TickIntervalUnit.days)
  const [planetDensity, setPlanetDensity] = useState<RangeInput>({ min: 0.4, max: 0.6 })
  const [nbPlanets, setNbPlanets] = useState<RangeInput>({ min: 9, max: 11 })
  const [nbMoonsPerPlanet, setNbMoonsPerPlanet] = useState<RangeInput>({ min: 1, max: 3 })
  const [nbAsteroidBelts, setNbAsteroidBelts] = useState<RangeInput>({ min: 1, max: 1 })
  const [nbAsteroidsPerSector, setNbAsteroidsPerSector] = useState<RangeInput>({ min: 1, max: 3 })
  const [seed, setSeed] = useState("")
  const navigate = useNavigate()
  const backendApiClient = useBackendApiClient()
  const createGame = useMutation(
    backendApiClient.games.create.mutationOptions() as UseMutationOptions<CreateGameResult, Error, CreateGameInput>,
  )
  const areStarSystemSettingsInvalid =
    !isValidDensityRange(planetDensity) ||
    !isValidIntegerRange(nbPlanets) ||
    !isValidIntegerRange(nbMoonsPerPlanet) ||
    !isValidIntegerRange(nbAsteroidBelts) ||
    !isValidIntegerRange(nbAsteroidsPerSector) ||
    (seed !== "" && !Number.isInteger(Number(seed)))
  const isCreateDisabled = name === "" || nbSeats < 2 || tickIntervalMultiplier < 1 || areStarSystemSettingsInvalid

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Create a new game" description="Set the lobby, turn cadence, and deterministic Star System generation settings." />
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
                setNbSeats(Number(event.target.value))
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
                  setTickIntervalMultiplier(Number(event.target.value))
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
          <div className="space-y-4 border-t border-border/60 pt-6 md:col-span-2">
            <div>
              <h2 className="text-base font-semibold">Star System generation</h2>
              {areStarSystemSettingsInvalid && (
                <p className="mt-1 text-sm text-destructive">Fix invalid ranges before creating the game.</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <RangeFields
                label="Planet density"
                minId="planet-density-min"
                maxId="planet-density-max"
                range={planetDensity}
                step={0.1}
                onChange={setPlanetDensity}
              />
              <RangeFields label="Number of Planets" minId="planets-min" maxId="planets-max" range={nbPlanets} onChange={setNbPlanets} />
              <RangeFields
                label="Number of Moons per Planet"
                minId="moons-min"
                maxId="moons-max"
                range={nbMoonsPerPlanet}
                onChange={setNbMoonsPerPlanet}
              />
              <RangeFields
                label="Number of Asteroid belts"
                minId="asteroid-belts-min"
                maxId="asteroid-belts-max"
                range={nbAsteroidBelts}
                onChange={setNbAsteroidBelts}
              />
              <RangeFields
                label="Number of Asteroids per Sector"
                minId="asteroids-min"
                maxId="asteroids-max"
                range={nbAsteroidsPerSector}
                onChange={setNbAsteroidsPerSector}
              />
              <div className="space-y-2">
                <Label htmlFor="star-system-seed">Seed</Label>
                <Input
                  id="star-system-seed"
                  type="number"
                  value={seed}
                  onChange={(event) => {
                    setSeed(event.target.value)
                  }}
                />
              </div>
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
                      starSystemGenerationSettings: {
                        planetDensity,
                        nbPlanets,
                        nbMoonsPerPlanet,
                        nbAsteroidBelts,
                        nbAsteroidsPerSector,
                        ...(seed === "" ? {} : { seed: Number(seed) }),
                      },
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

function RangeFields({
  label,
  minId,
  maxId,
  range,
  step = 1,
  onChange,
}: {
  label: string
  minId: string
  maxId: string
  range: RangeInput
  step?: number
  onChange: (range: RangeInput) => void
}): ReactElement {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id={minId}
          aria-label={`${label} minimum`}
          type="number"
          step={step}
          value={range.min}
          onChange={(event) => {
            onChange({ ...range, min: Number(event.target.value) })
          }}
        />
        <Input
          id={maxId}
          aria-label={`${label} maximum`}
          type="number"
          step={step}
          value={range.max}
          onChange={(event) => {
            onChange({ ...range, max: Number(event.target.value) })
          }}
        />
      </div>
    </div>
  )
}

function isValidDensityRange(range: RangeInput): boolean {
  return range.min >= 0 && range.max <= 1 && range.min <= range.max
}

function isValidIntegerRange(range: RangeInput): boolean {
  return Number.isInteger(range.min) && Number.isInteger(range.max) && range.min >= 0 && range.max >= 0 && range.min <= range.max
}
