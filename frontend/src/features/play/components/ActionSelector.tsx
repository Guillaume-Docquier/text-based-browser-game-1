import type * as ApiTypes from "@api-types"
import type { PlayerView } from "@api-types"
import { AlertTriangle, CheckCircle2, Coins } from "lucide-react"
import type { KeyboardEvent, ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { useSetCurrentActionMutation } from "@/lib/api/useSetCurrentActionMutation.ts"
import { cn } from "@/lib/cn.ts"

const PLAYER_ACTIONS = [
  {
    actionType: "MAKE_MORE_MONEY",
    label: "Make More Money",
    description: "Turn 2 money into 5 extra money after the normal turn income.",
    costMoney: 2,
    rewardMoney: 5,
  },
  {
    actionType: "WIN_THE_GAME",
    label: "Win The Game",
    description: "Spend 10 money and immediately end the game in your favor.",
    costMoney: 10,
    rewardMoney: 0,
  },
] as const satisfies Array<{
  actionType: ApiTypes.ActionDto["actionType"]
  label: string
  description: string
  costMoney: number
  rewardMoney: number
}>

export function ActionSelector({
  gameId,
  playerView,
  currentAction,
}: {
  gameId: ApiTypes.GameId
  playerView: PlayerView
  currentAction: ApiTypes.ActionDto | null
}): ReactElement {
  const setCurrentAction = useSetCurrentActionMutation()

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Actions</div>
          <h2 className="font-heading text-2xl font-semibold text-foreground">Choose your action</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Your selection applies to turn {playerView.turn} only. Click the selected action again to clear it.
          </p>
        </div>
        <div className="flex h-10 w-fit items-center gap-2 rounded-md border border-border/70 bg-card/45 px-3 text-sm font-medium text-foreground">
          <Coins className="size-4 text-primary" />
          {playerView.resources.money} money
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PLAYER_ACTIONS.map((action) => {
          const isSelected = currentAction?.actionType === action.actionType
          const hasEnoughMoney = playerView.resources.money >= action.costMoney
          const disabledReason = !hasEnoughMoney && !isSelected ? `Requires ${action.costMoney} money.` : undefined
          const canSubmitAction = !setCurrentAction.isPending && (hasEnoughMoney || isSelected)

          return (
            <Card
              key={action.actionType}
              role="button"
              tabIndex={canSubmitAction ? 0 : -1}
              aria-pressed={isSelected}
              aria-disabled={!canSubmitAction}
              className={cn("border text-left transition-colors", {
                "border-primary/50 bg-primary/5": isSelected,
                "border-border/60": !isSelected,
                "cursor-pointer hover:bg-muted/30": canSubmitAction,
                "cursor-not-allowed opacity-80": !canSubmitAction,
              })}
              onClick={() => {
                if (!canSubmitAction) {
                  return
                }

                setCurrentAction.mutate({
                  gameId,
                  turn: playerView.turn,
                  actionType: isSelected ? null : action.actionType,
                })
              }}
              onKeyDown={(event) => {
                handleActionCardKeyDown({
                  event,
                  canSubmitAction,
                  onSelect: () => {
                    setCurrentAction.mutate({
                      gameId,
                      turn: playerView.turn,
                      actionType: isSelected ? null : action.actionType,
                    })
                  },
                })
              }}
            >
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{action.label}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </div>
                  {isSelected ? <CheckCircle2 className="size-5 text-primary" /> : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="text-sm text-muted-foreground">
                  Cost: {action.costMoney} money
                  {action.rewardMoney > 0
                    ? ` | Effect: +${action.rewardMoney} money after paying the cost`
                    : " | Effect: End the game immediately"}
                </div>
                {disabledReason === undefined ? null : (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>Unavailable</AlertTitle>
                    <AlertDescription>{disabledReason}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )
        })}
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

export function ActionSelectorSkeleton(): ReactElement {
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
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </section>
  )
}

function handleActionCardKeyDown({
  event,
  canSubmitAction,
  onSelect,
}: {
  event: KeyboardEvent<HTMLDivElement>
  canSubmitAction: boolean
  onSelect: () => void
}): void {
  if (!canSubmitAction || (event.key !== "Enter" && event.key !== " ")) {
    return
  }

  event.preventDefault()
  onSelect()
}
