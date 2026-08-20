import type { ActionDefinition, ActionSubmission, GameId, PlayerView } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import { AlertTriangle, Compass, CheckCircle2, Coins, Crosshair, Landmark, type LucideIcon } from "lucide-react"
import type { KeyboardEvent, ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { formatRulesetTerm, mechanicsToRulesText } from "@/features/play/mechanicToRulesText.ts"
import { useSetCurrentActionMutation } from "@/lib/api/useSetCurrentActionMutation.ts"
import { cn } from "@/lib/cn.ts"

const ACTION_TIER_STYLES = {
  BASIC: {
    card: "border-zinc-500/70 bg-linear-to-b from-zinc-500/15 via-card to-card",
    icon: "border-zinc-300 bg-zinc-600 text-zinc-50 shadow-zinc-950/40",
  },
  STANDARD: {
    card: "border-slate-100/70 bg-linear-to-b from-slate-100/15 via-card to-card",
    icon: "border-white bg-slate-100 text-slate-900 shadow-white/20",
  },
  IMPROVED: {
    card: "border-sky-400/70 bg-linear-to-b from-sky-500/15 via-card to-card",
    icon: "border-sky-200 bg-sky-500 text-sky-950 shadow-sky-500/30",
  },
  ADVANCED: {
    card: "border-yellow-400/70 bg-linear-to-b from-yellow-400/15 via-card to-card",
    icon: "border-yellow-200 bg-yellow-400 text-yellow-950 shadow-yellow-400/30",
  },
  EXCEPTIONAL: {
    card: "border-orange-400/80 bg-linear-to-b from-orange-500/20 via-card to-card",
    icon: "border-orange-200 bg-orange-500 text-orange-950 shadow-orange-500/30",
  },
} as const satisfies Record<ActionDefinition["tier"], { card: string; icon: string }>

const ACTION_TYPE_ICONS = {
  AGENDA: Compass,
  DIRECTIVE: Crosshair,
  PROGRAM: Landmark,
} as const satisfies Record<ActionDefinition["type"], LucideIcon>

type ResourceType = ActionDefinition["costs"][number]["resourceType"]
const RESOURCE_ICONS = {
  MONEY: Coins,
} as const satisfies Record<ResourceType, LucideIcon>

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
              {quantity} {formatRulesetTerm(resourceType)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-6 px-4 pt-4">
        {playerView.availableActions.map((action) => {
          const actionDefinition = playerView.ruleset.actionDefinitions[action.actionDefinitionId]
          Assert.isDefined(actionDefinition)
          const tierStyle = ACTION_TIER_STYLES[actionDefinition.tier]
          const ActionIcon = ACTION_TYPE_ICONS[actionDefinition.type]
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
              className={cn(
                "relative w-full overflow-visible rounded-2xl border-2 py-0 text-left shadow-lg transition-[transform,box-shadow,opacity] sm:w-80",
                tierStyle.card,
                {
                  "ring-2 ring-primary ring-offset-2 ring-offset-background": isSelected,
                  "cursor-pointer hover:-translate-y-0.5 hover:shadow-xl": canSubmitAction,
                  "cursor-not-allowed opacity-80": !canSubmitAction,
                },
              )}
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
              <div
                className={cn("absolute -top-3 -left-4 z-10 grid size-14 place-items-center rounded-xl border-2 shadow-lg", tierStyle.icon)}
                aria-hidden="true"
              >
                <ActionIcon className="size-7" strokeWidth={1.8} />
              </div>
              <CardHeader className="min-h-24 px-5 py-5 pl-14">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="truncate text-xl font-semibold">{actionDefinition.name}</CardTitle>
                    <CardDescription className="text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
                      {formatRulesetTerm(actionDefinition.tier)} {formatRulesetTerm(actionDefinition.type)}
                    </CardDescription>
                  </div>
                  <div className="flex items-start gap-2">
                    <ActionCosts costs={actionDefinition.costs} />
                    {isSelected ? <CheckCircle2 className="size-5 shrink-0 text-primary" /> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-36 flex-1 flex-col gap-4 border-t border-border/70 px-5 py-5">
                <p className="leading-relaxed text-card-foreground">{mechanicsToRulesText(actionDefinition.mechanics)}</p>
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

function ActionCosts({ costs }: { costs: ActionDefinition["costs"] }): ReactElement {
  return (
    <div className="flex flex-col items-end gap-1" aria-label="Costs">
      {costs.map((cost) => {
        const ResourceIcon = RESOURCE_ICONS[cost.resourceType]
        return (
          <div key={cost.resourceType} className="flex items-center gap-1 text-sm font-bold">
            <span>{cost.quantity}</span>
            <ResourceIcon className="size-4 text-amber-300" aria-hidden="true" />
            <span className="sr-only"> {formatRulesetTerm(cost.resourceType)}</span>
          </div>
        )
      })}
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
      <div className="flex flex-wrap gap-6 px-4 pt-4">
        <Skeleton className="h-64 w-full sm:w-80" />
        <Skeleton className="h-64 w-full sm:w-80" />
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
