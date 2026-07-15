import type * as ApiTypes from "@api-types"
import type { MovementTarget, PlayerView } from "@api-types"
import { AlertTriangle, CheckCircle2, Coins } from "lucide-react"
import { type ReactElement, type ReactNode, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/card.tsx"
import { Label } from "@/components/label.tsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { useSetCurrentActionMutation } from "@/lib/api/useSetCurrentActionMutation.ts"
import { cn } from "@/lib/cn.ts"

const BASIC_PLAYER_ACTIONS = [
  {
    actionType: "MAKE_MORE_MONEY",
    label: "Make More Money",
    description: "Turn 2 money into 5 extra money after the normal tick income.",
    costMoney: 2,
    effect: "+5 money after paying the cost",
  },
  {
    actionType: "WIN_THE_GAME",
    label: "Win The Game",
    description: "Spend 10 money and immediately end the game in your favor.",
    costMoney: 10,
    effect: "End the game immediately",
  },
] as const satisfies ReadonlyArray<{
  actionType: Exclude<ApiTypes.GamePlayerAction["actionType"], "BUILD_UNIT">
  label: string
  description: string
  costMoney: number
  effect: string
}>

type BuildOption = {
  readonly value: string
  readonly coordinates: string
  readonly label: string
  readonly destination: MovementTarget
}

export function GameActionSelector({
  gameId,
  playerView,
  currentAction,
}: {
  gameId: ApiTypes.GameId
  playerView: PlayerView
  currentAction: ApiTypes.GamePlayerAction | null
}): ReactElement {
  const setCurrentAction = useSetCurrentActionMutation()
  const buildOptions = createBuildOptions(playerView)
  const [selectedBuildOptionValue, setSelectedBuildOptionValue] = useState(() =>
    currentAction?.actionType === "BUILD_UNIT"
      ? buildOptions.find((option) => movementTargetsAreEqual(option.destination, currentAction.destination))?.value
      : undefined,
  )
  const selectedBuildOption = buildOptions.find((option) => option.value === selectedBuildOptionValue)

  const clearAction = (): void => {
    setCurrentAction.mutate({ gameId, tick: playerView.tick, action: null })
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Actions</div>
          <h2 className="font-heading text-2xl font-semibold text-foreground">Choose your action</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">Your selection applies to tick {playerView.tick} only.</p>
        </div>
        <div className="flex h-10 w-fit items-center gap-2 rounded-md border border-border/70 bg-card/45 px-3 text-sm font-medium text-foreground">
          <Coins className="size-4 text-primary" />
          {playerView.resources.money} money
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {BASIC_PLAYER_ACTIONS.map((action) => {
          const isSelected = currentAction?.actionType === action.actionType
          const hasEnoughMoney = playerView.resources.money >= action.costMoney

          return (
            <ActionCard
              key={action.actionType}
              title={action.label}
              description={action.description}
              isSelected={isSelected}
              details={`Cost: ${action.costMoney} money | Effect: ${action.effect}`}
              unavailableReason={!hasEnoughMoney ? `Requires ${action.costMoney} money.` : undefined}
              footer={
                <ActionButtons
                  actionLabel={action.label}
                  canSubmit={hasEnoughMoney}
                  isPending={setCurrentAction.isPending}
                  isSelected={isSelected}
                  onClear={clearAction}
                  onSubmit={() => {
                    setCurrentAction.mutate({
                      gameId,
                      tick: playerView.tick,
                      action: { actionType: action.actionType },
                    })
                  }}
                />
              }
            />
          )
        })}

        <ActionCard
          title="Build Unit"
          description="Spend 1 money to create a Unit at any Sector or Body after the normal tick income."
          isSelected={currentAction?.actionType === "BUILD_UNIT"}
          details="Cost: 1 money | Effect: Create one Unit at the selected destination"
          unavailableReason={playerView.resources.money < 1 ? "Requires 1 money." : undefined}
          footer={
            <ActionButtons
              actionLabel="Build Unit"
              canSubmit={playerView.resources.money >= 1 && selectedBuildOption !== undefined}
              isPending={setCurrentAction.isPending}
              isSelected={currentAction?.actionType === "BUILD_UNIT"}
              onClear={clearAction}
              onSubmit={() => {
                if (selectedBuildOption === undefined) {
                  return
                }

                setCurrentAction.mutate({
                  gameId,
                  tick: playerView.tick,
                  action: { actionType: "BUILD_UNIT", destination: selectedBuildOption.destination },
                })
              }}
            />
          }
        >
          <div className="space-y-2">
            <Label htmlFor="build-unit-destination">Destination</Label>
            <Select value={selectedBuildOptionValue} onValueChange={setSelectedBuildOptionValue}>
              <SelectTrigger id="build-unit-destination" className="w-full" aria-label="Build destination">
                <SelectValue placeholder="Select a Sector or Body" />
              </SelectTrigger>
              <SelectContent>
                {buildOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ActionCard>
      </div>

      {setCurrentAction.isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not update action</AlertTitle>
          <AlertDescription>{setCurrentAction.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

function ActionCard({
  title,
  description,
  details,
  isSelected,
  unavailableReason,
  children,
  footer,
}: {
  title: string
  description: string
  details: string
  isSelected: boolean
  unavailableReason?: string
  children?: ReactNode
  footer: ReactNode
}): ReactElement {
  return (
    <Card className={cn("border", isSelected ? "border-primary/50 bg-primary/5" : "border-border/60")}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isSelected ? <CheckCircle2 aria-label="Selected action" className="size-5 text-primary" /> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="text-sm text-muted-foreground">{details}</div>
        {children}
        {unavailableReason === undefined ? null : (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Unavailable</AlertTitle>
            <AlertDescription>{unavailableReason}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>{footer}</CardFooter>
    </Card>
  )
}

function ActionButtons({
  actionLabel,
  canSubmit,
  isPending,
  isSelected,
  onSubmit,
  onClear,
}: {
  actionLabel: string
  canSubmit: boolean
  isPending: boolean
  isSelected: boolean
  onSubmit: () => void
  onClear: () => void
}): ReactElement {
  return (
    <div className="flex w-full flex-wrap gap-2">
      <Button disabled={isPending || !canSubmit} onClick={onSubmit}>
        {isSelected ? `Update ${actionLabel}` : `Select ${actionLabel}`}
      </Button>
      <Button disabled={isPending || !isSelected} variant="outline" onClick={onClear}>
        Clear
      </Button>
    </div>
  )
}

function createBuildOptions(playerView: PlayerView): BuildOption[] {
  const options: BuildOption[] = []

  for (const orbit of playerView.starSystem.orbits) {
    for (const sector of orbit.sectors) {
      options.push({
        value: `SECTOR:${sector.id}`,
        coordinates: sector.coordinates,
        label: `${sector.coordinates} — Sector`,
        destination: { targetType: "SECTOR", sectorId: sector.id },
      })

      for (const body of sector.bodies) {
        options.push({
          value: `BODY:${body.id}`,
          coordinates: body.coordinates,
          label: `${body.coordinates} — ${body.name}`,
          destination: { targetType: "BODY", bodyId: body.id },
        })
      }
    }
  }

  return options.sort((left, right) => left.coordinates.localeCompare(right.coordinates))
}

function movementTargetsAreEqual(left: MovementTarget, right: MovementTarget): boolean {
  if (left.targetType === "SECTOR") {
    return right.targetType === "SECTOR" && left.sectorId === right.sectorId
  }

  return right.targetType === "BODY" && left.bodyId === right.bodyId
}

export function GameActionSelectorSkeleton(): ReactElement {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </section>
  )
}
