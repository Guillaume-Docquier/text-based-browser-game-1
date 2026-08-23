import type { ActionSubmission, ActionTier, GameId, PlayerView } from "@api-types"
import { Sort } from "@guillaume-docquier/tools-ts"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
import { Skeleton } from "@/components/skeleton.tsx"
import { ActionCard } from "@/features/play/components/ActionCard.tsx"
import { useSetCurrentActionMutation } from "@/lib/api/useSetCurrentActionMutation.ts"
import { useSetReadyMutation } from "@/lib/api/useSetReadyMutation.ts"

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
  const setReady = useSetReadyMutation()

  return (
    <section className="flex flex-col gap-5">
      <div className="space-y-1">
        <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Actions</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-semibold text-foreground">Choose your action</h2>
          <Button
            type="button"
            variant={playerView.player.ready ? "outline" : "default"}
            disabled={setCurrentAction.isPending || setReady.isPending}
            onClick={() => {
              setReady.mutate({ gameId, ready: !playerView.player.ready })
            }}
          >
            {playerView.player.ready ? "Unready" : "Ready"}
          </Button>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {playerView.player.ready
            ? "Your action is locked. Unready before changing it."
            : `Your selection applies to turn ${playerView.turn} only. Click the selected action again to clear it.`}
        </p>
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
                disabled={playerView.player.ready || setCurrentAction.isPending || setReady.isPending || (!action.canAfford && !isSelected)}
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

      {setReady.isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not update readiness</AlertTitle>
          <AlertDescription>{setReady.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}

export function ActionSelectorSkeleton(): ReactElement {
  return (
    <section className="flex flex-col gap-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex flex-wrap gap-6 px-4 pt-4">
        <Skeleton className="h-64 w-full sm:w-80" />
        <Skeleton className="h-64 w-full sm:w-80" />
      </div>
    </section>
  )
}
