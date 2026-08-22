import type { ActionSubmission, ActionTier, GameId, PlayerView } from "@api-types"
import { Sort } from "@guillaume-docquier/tools-ts"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { ActionCard } from "@/features/play/components/ActionCard.tsx"
import { formatRulesetTerm } from "@/features/play/mechanicToRulesText.ts"
import { useSetCurrentActionMutation } from "@/lib/api/useSetCurrentActionMutation.ts"

// This should probably be data driven
export const ActionTierRank = {
  BASIC: 1, // Worst
  STANDARD: 2,
  IMPROVED: 3,
  ADVANCED: 4,
  EXCEPTIONAL: 5, // Best
} as const satisfies Record<ActionTier, number>

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
        {playerView.availableActions
          .map((action) => ({ action, definition: playerView.ruleset.actionDefinitions[action.actionDefinitionId] }))
          .sort((action1, action2) => Sort.byAscending(ActionTierRank[action1.definition.tier], ActionTierRank[action2.definition.tier]))
          .map(({ action, definition }) => {
            const isSelected = currentAction?.actionDefinitionId === action.actionDefinitionId
            const selectAction = (): void => {
              setCurrentAction.mutate({
                gameId,
                turn: playerView.turn,
                actionSubmission: isSelected ? null : action,
              })
            }
            return (
              <ActionCard
                key={action.id}
                actionDefinition={definition}
                resources={playerView.resources}
                canAfford={action.canAfford}
                isSelected={isSelected}
                disabled={setCurrentAction.isPending || (!action.canAfford && !isSelected)}
                onSelect={selectAction}
              />
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
      <div className="flex flex-wrap gap-6 px-4 pt-4">
        <Skeleton className="h-64 w-full sm:w-80" />
        <Skeleton className="h-64 w-full sm:w-80" />
      </div>
    </section>
  )
}
