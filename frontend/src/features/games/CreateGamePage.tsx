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
type RangeInput = {
  min: number
  max: number
}
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
  const areGenerationSettingsInvalid =
    isPercentageRangeInvalid(planetDensity) ||
    isIntegerRangeInvalid(nbPlanets) ||
    isIntegerRangeInvalid(nbMoonsPerPlanet) ||
    isIntegerRangeInvalid(nbAsteroidBelts) ||
    isIntegerRangeInvalid(nbAsteroidsPerSector) ||
    isSeedInvalid(seed)
  const isCreateDisabled =
    name === "" ||
    !Number.isFinite(nbSeats) ||
    nbSeats < 2 ||
    !Number.isFinite(tickIntervalMultiplier) ||
    tickIntervalMultiplier <= 0 ||
    areGenerationSettingsInvalid

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title="Create a new game" description="Set the lobby, turn cadence, and generated Star System shape." />
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
              value={toNumberInputValue(nbSeats)}
              onChange={(event) => {
                setNbSeats(parseNumber(event.target.value))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Turn length</Label>
            <div className="flex gap-3">
              <Input
                type="number"
                value={toNumberInputValue(tickIntervalMultiplier)}
                onChange={(event) => {
                  setTickIntervalMultiplier(parseNumber(event.target.value))
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
        </CardContent>
      </Card>

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Star System generation</CardTitle>
          <CardDescription>The same settings and seed will always produce the same Star System.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <RangeInputs id="planet-density" label="Planet density" range={planetDensity} step={0.1} onChange={setPlanetDensity} />
          <RangeInputs id="nb-planets" label="Number of Planets" range={nbPlanets} onChange={setNbPlanets} />
          <RangeInputs
            id="nb-moons-per-planet"
            label="Number of Moons per Planet"
            range={nbMoonsPerPlanet}
            onChange={setNbMoonsPerPlanet}
          />
          <RangeInputs id="nb-asteroid-belts" label="Number of Asteroid belts" range={nbAsteroidBelts} onChange={setNbAsteroidBelts} />
          <RangeInputs
            id="nb-asteroids-per-sector"
            label="Number of Asteroids per Sector"
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
              placeholder="Random"
            />
          </div>
          {areGenerationSettingsInvalid && (
            <p className="text-sm text-destructive md:col-span-2">Star System generation settings contain an invalid range.</p>
          )}
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
                        ...(seed === "" ? {} : { seed: parseNumber(seed) }),
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

function RangeInputs({
  id,
  label,
  range,
  step = 1,
  onChange,
}: {
  id: string
  label: string
  range: RangeInput
  step?: number
  onChange: (range: RangeInput) => void
}): ReactElement {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id={`${id}-min`}
          type="number"
          step={step}
          aria-label={`${label} minimum`}
          value={toNumberInputValue(range.min)}
          onChange={(event) => {
            onChange({ ...range, min: parseNumber(event.target.value) })
          }}
        />
        <Input
          id={`${id}-max`}
          type="number"
          step={step}
          aria-label={`${label} maximum`}
          value={toNumberInputValue(range.max)}
          onChange={(event) => {
            onChange({ ...range, max: parseNumber(event.target.value) })
          }}
        />
      </div>
    </div>
  )
}

function parseNumber(value: string): number {
  if (value === "") {
    return Number.NaN
  }

  return Number(value)
}

function toNumberInputValue(value: number): number | "" {
  if (Number.isNaN(value)) {
    return ""
  }

  return value
}

function isPercentageRangeInvalid(range: RangeInput): boolean {
  return !isFiniteRange(range) || range.min < 0 || range.max > 1 || range.min > range.max
}

function isIntegerRangeInvalid(range: RangeInput): boolean {
  return !isFiniteRange(range) || !Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min < 0 || range.min > range.max
}

function isFiniteRange(range: RangeInput): boolean {
  return Number.isFinite(range.min) && Number.isFinite(range.max)
}

function isSeedInvalid(seed: string): boolean {
  if (seed === "") {
    return false
  }

  const numericSeed = parseNumber(seed)

  return !Number.isInteger(numericSeed) || numericSeed < 0 || numericSeed > 2 ** 32 - 1
}
