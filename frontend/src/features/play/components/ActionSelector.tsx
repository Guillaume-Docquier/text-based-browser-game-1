import type { ActionTier, GameId, PlayerView } from "@api-types"
import { Sort } from "@guillaume-docquier/tools-ts"
import { AlertTriangle } from "lucide-react"
import type { ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { ActionCard } from "@/features/play/components/ActionCard.tsx"
import { useUpdateActionSubmission } from "@/lib/api/useUpdateActionSubmission.ts"

// This should probably be data driven
export const ActionTierRank = {
  BASIC: 1, // Worst
  STANDARD: 2,
  IMPROVED: 3,
  ADVANCED: 4,
  EXCEPTIONAL: 5, // Best
} as const satisfies Record<ActionTier, number>

export function ActionSelector({ gameId, playerView }: { gameId: GameId; playerView: PlayerView }): ReactElement {
  const updateActionSubmission = useUpdateActionSubmission()
  const isTurnLocked = playerView.turnStatus !== "COLLECTING_ACTIONS" || playerView.player.isReady

  return (
    <section className="flex flex-col gap-5">
      <div className="space-y-1">
        <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Actions</div>
        <h2 className="font-heading text-2xl font-semibold text-foreground">Choose your action</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your selection applies to turn {playerView.turn} only. Click the selected action again to clear it.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-6 px-4 pt-4">
        {playerView.actions
          .map((action) => ({ action, definition: playerView.ruleset.actionDefinitions[action.actionDefinitionId] }))
          .sort((action1, action2) => Sort.byAscending(ActionTierRank[action1.definition.tier], ActionTierRank[action2.definition.tier]))
          .map(({ action, definition }) => {
            const isSelected = action.targets !== null
            const selectAction = (): void => {
              updateActionSubmission.mutate({
                gameId,
                turn: playerView.turn,
                submittedActionTargets: {
                  actionId: action.id,
                  targets: isSelected ? null : {}, // no targets to select yet
                },
              })
            }
            return (
              <ActionCard
                key={action.id}
                actionDefinition={definition}
                resources={playerView.resources}
                canAfford={action.canAfford}
                isSelected={isSelected}
                disabled={isTurnLocked || updateActionSubmission.isPending || (!action.canAfford && !isSelected)}
                onSelect={selectAction}
              />
            )
          })}
      </div>

      {updateActionSubmission.isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Could not update action</AlertTitle>
          <AlertDescription>{updateActionSubmission.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
