import type { ActionSubmission, GameId, Mechanic, PlayerView } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import type { KeyboardEvent, ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Badge } from "@/components/badge.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { formatResourceType, mechanicToRulesText } from "@/features/play/mechanicToRulesText.ts"
import { useSetCurrentActionMutation } from "@/lib/api/useSetCurrentActionMutation.ts"
import { cn } from "@/lib/cn.ts"

export function ActionSelector({
  gameId,
  playerView,
  currentAction,
}: {
  gameId: GameId
  playerView: PlayerView
  currentAction: ActionSubmission | null
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
        <div className="flex h-10 w-fit items-center gap-3 rounded-md border border-border/70 bg-card/45 px-3 text-sm font-medium text-foreground">
          {Object.entries(playerView.resources).map(([resourceType, quantity]) => (
            <span key={resourceType}>
              {quantity} {formatResourceType(resourceType)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {playerView.availableActions.map((action) => {
          const actionDefinition = playerView.ruleset.actionDefinitions[action.actionDefinitionId]
          Assert.isDefined(actionDefinition)
          const isSelected = currentAction?.actionDefinitionId === action.actionDefinitionId
          const disabledReason = !action.canAfford && !isSelected ? "You cannot afford this action." : undefined
          const canSubmitAction = !setCurrentAction.isPending && (action.canAfford || isSelected)
          const selectAction = (): void => {
            setCurrentAction.mutate({
              gameId,
              turn: playerView.turn,
              actionSubmission: isSelected ? null : action,
            })
          }
          return (
            <Card
              key={action.id}
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

                selectAction()
              }}
              onKeyDown={(event) => {
                handleActionCardKeyDown({
                  event,
                  canSubmitAction,
                  onSelect: selectAction,
                })
              }}
            >
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{actionDefinition.name}</CardTitle>
                    <CardDescription className="flex gap-2 pt-1 capitalize">
                      <Badge variant="outline">{actionDefinition.type.toLowerCase()}</Badge>
                      <Badge variant="outline">{actionDefinition.tier.toLowerCase()}</Badge>
                    </CardDescription>
                  </div>
                  {isSelected ? <CheckCircle2 className="size-5 text-primary" /> : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <RulesList title="Costs" mechanics={actionDefinition.costs} />
                <RulesList title="Effects" mechanics={actionDefinition.mechanics} />
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

function RulesList({ title, mechanics }: { title: string; mechanics: readonly Mechanic[] }): ReactElement {
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">{title}</div>
      <ul className="list-disc space-y-1 pl-5">
        {mechanics.map((mechanic, index) => (
          <li key={`${mechanic.type}-${index}`}>{mechanicToRulesText(mechanic)}</li>
        ))}
      </ul>
    </div>
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
