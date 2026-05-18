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

type RangeInputState = {
  min: string
  max: string
}

export function CreateGamePage(): ReactElement {
  const [name, setName] = useState("")
  const [nbSeats, setNbSeats] = useState(5)
  const [tickIntervalMultiplier, setTickIntervalMultiplier] = useState(1)
  const [tickIntervalUnit, setTickIntervalUnit] = useState<TickIntervalUnit>(TickIntervalUnit.days)
  const [planetDensity, setPlanetDensity] = useState<RangeInputState>({ min: "0.4", max: "0.6" })
  const [nbPlanets, setNbPlanets] = useState<RangeInputState>({ min: "9", max: "11" })
  const [nbMoonsPerPlanet, setNbMoonsPerPlanet] = useState<RangeInputState>({ min: "1", max: "3" })
  const [nbAsteroidBelts, setNbAsteroidBelts] = useState<RangeInputState>({ min: "1", max: "1" })
  const [nbAsteroidsPerSector, setNbAsteroidsPerSector] = useState<RangeInputState>({ min: "1", max: "3" })
  const [seed, setSeed] = useState("")
  const navigate = useNavigate()
  const backendApiClient = useBackendApiClient()
  const createGame = useMutation(
    backendApiClient.games.create.mutationOptions() as UseMutationOptions<CreateGameResult, Error, CreateGameInput>,
  )
  const validationErrors = getValidationErrors({
    name,
    nbSeats,
    ranges: {
      planetDensity,
      nbPlanets,
      nbMoonsPerPlanet,
      nbAsteroidBelts,
      nbAsteroidsPerSector,
    },
    seed,
  })
  const isCreateDisabled = validationErrors.length > 0

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
        <CardContent className="grid gap-8 md:grid-cols-2">
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
          <div className="space-y-4 md:col-span-2">
            <div>
              <h2 className="text-base font-semibold">Star System generation</h2>
              <p className="text-sm text-muted-foreground">Generation settings are saved with the game and drive the deterministic map.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <RangeFields id="planet-density" label="Planet density" value={planetDensity} onChange={setPlanetDensity} step="0.1" />
              <RangeFields id="nb-planets" label="Number of Planets" value={nbPlanets} onChange={setNbPlanets} />
              <RangeFields
                id="nb-moons-per-planet"
                label="Number of Moons per Planet"
                value={nbMoonsPerPlanet}
                onChange={setNbMoonsPerPlanet}
              />
              <RangeFields id="nb-asteroid-belts" label="Number of Asteroid belts" value={nbAsteroidBelts} onChange={setNbAsteroidBelts} />
              <RangeFields
                id="nb-asteroids-per-sector"
                label="Number of Asteroids per Sector"
                value={nbAsteroidsPerSector}
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
            </div>
            {validationErrors.length > 0 ? <p className="text-sm text-destructive">{validationErrors[0]}</p> : null}
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
                      starSystemGenerationSettings: toStarSystemGenerationSettings({
                        planetDensity,
                        nbPlanets,
                        nbMoonsPerPlanet,
                        nbAsteroidBelts,
                        nbAsteroidsPerSector,
                        seed,
                      }),
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
  id,
  label,
  value,
  onChange,
  step = "1",
}: {
  id: string
  label: string
  value: RangeInputState
  onChange: (value: RangeInputState) => void
  step?: string
}): ReactElement {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id={`${id}-min`}
          type="number"
          step={step}
          value={value.min}
          onChange={(event) => {
            onChange({ ...value, min: event.target.value })
          }}
          aria-label={`${label} minimum`}
        />
        <Input
          id={`${id}-max`}
          type="number"
          step={step}
          value={value.max}
          onChange={(event) => {
            onChange({ ...value, max: event.target.value })
          }}
          aria-label={`${label} maximum`}
        />
      </div>
    </div>
  )
}

function getValidationErrors({
  name,
  nbSeats,
  ranges,
  seed,
}: {
  name: string
  nbSeats: number
  ranges: {
    planetDensity: RangeInputState
    nbPlanets: RangeInputState
    nbMoonsPerPlanet: RangeInputState
    nbAsteroidBelts: RangeInputState
    nbAsteroidsPerSector: RangeInputState
  }
  seed: string
}): string[] {
  const errors: string[] = []

  if (name === "") {
    errors.push("Game name is required.")
  }

  if (nbSeats < 2) {
    errors.push("Max number of players must be at least 2.")
  }

  if (!isValidRange(ranges.planetDensity) || toRange(ranges.planetDensity).min < 0 || toRange(ranges.planetDensity).max > 1) {
    errors.push("Planet density must be a valid range between 0 and 1.")
  }

  const integerRanges = [ranges.nbPlanets, ranges.nbMoonsPerPlanet, ranges.nbAsteroidBelts, ranges.nbAsteroidsPerSector]
  if (!integerRanges.every((range) => isValidRange(range) && isIntegerRange(range) && toRange(range).min >= 0)) {
    errors.push("Integer generation settings must use non-negative whole-number ranges.")
  }

  if (seed !== "") {
    const numericSeed = Number(seed)
    if (!Number.isInteger(numericSeed) || numericSeed < 0 || numericSeed > 4_294_967_295) {
      errors.push("Seed must be an unsigned 32-bit integer.")
    }
  }

  return errors
}

function isValidRange(range: RangeInputState): boolean {
  const parsedRange = toRange(range)

  return Number.isFinite(parsedRange.min) && Number.isFinite(parsedRange.max) && parsedRange.min <= parsedRange.max
}

function isIntegerRange(range: RangeInputState): boolean {
  const parsedRange = toRange(range)

  return Number.isInteger(parsedRange.min) && Number.isInteger(parsedRange.max)
}

function toRange(range: RangeInputState): RangeInput {
  return {
    min: Number(range.min),
    max: Number(range.max),
  }
}

function toStarSystemGenerationSettings({
  planetDensity,
  nbPlanets,
  nbMoonsPerPlanet,
  nbAsteroidBelts,
  nbAsteroidsPerSector,
  seed,
}: {
  planetDensity: RangeInputState
  nbPlanets: RangeInputState
  nbMoonsPerPlanet: RangeInputState
  nbAsteroidBelts: RangeInputState
  nbAsteroidsPerSector: RangeInputState
  seed: string
}): CreateGameInput["newGame"]["starSystemGenerationSettings"] {
  const settings = {
    planetDensity: toRange(planetDensity),
    nbPlanets: toRange(nbPlanets),
    nbMoonsPerPlanet: toRange(nbMoonsPerPlanet),
    nbAsteroidBelts: toRange(nbAsteroidBelts),
    nbAsteroidsPerSector: toRange(nbAsteroidsPerSector),
  }

  if (seed === "") {
    return settings
  }

  return {
    ...settings,
    seed: Number(seed),
  }
}
