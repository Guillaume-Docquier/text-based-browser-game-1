import type { ActionTier, GameId, PlayerView } from "@api-types"
import { Sort } from "@guillaume-docquier/tools-ts"
import { AlertTriangle } from "lucide-react"
import { useState, type ReactElement } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert.tsx"
import { Button } from "@/components/button.tsx"
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
  const [targetSelections, setTargetSelections] = useState<Record<string, Record<string, string>>>({})

  return (
    <section className="flex flex-col gap-5">
      <div className="space-y-1">
        <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Actions</div>
        <h2 className="font-heading text-2xl font-semibold text-foreground">Choose your action</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your selection applies to turn {playerView.turn} only. Select an action and fill its targets, then use Deselect to clear it.
        </p>
      </div>

      <div className="flex flex-wrap items-stretch gap-6 px-4 pt-4">
        {playerView.actions
          .map((action) => ({ action, definition: playerView.ruleset.actionDefinitions[action.actionDefinitionId] }))
          .sort((action1, action2) => Sort.byAscending(ActionTierRank[action1.definition.tier], ActionTierRank[action2.definition.tier]))
          .map(({ action, definition }) => {
            const isSelected = action.targets !== null
            const targets = targetSelections[action.id] ?? action.targets ?? {}
            const targetSlots = Object.entries(action.targetOptions)
            const hasAllTargets = targetSlots.every(([targetSlot]) => targets[targetSlot] !== undefined && targets[targetSlot] !== "")
            const selectAction = (): void => {
              if (!hasAllTargets) {
                return
              }

              updateActionSubmission.mutate({
                gameId,
                turn: playerView.turn,
                submittedActionTargets: {
                  actionId: action.id,
                  targets,
                },
              })
            }
            const deselectAction = (): void => {
              setTargetSelections((currentSelections) => {
                return Object.fromEntries(Object.entries(currentSelections).filter(([actionId]) => actionId !== action.id))
              })
              updateActionSubmission.mutate({
                gameId,
                turn: playerView.turn,
                submittedActionTargets: {
                  actionId: action.id,
                  targets: null,
                },
              })
            }
            const controls = (
              <div className="mt-auto flex flex-col gap-3 border-t border-border/70 pt-3" data-action-controls>
                {targetSlots.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Targets</div>
                    {targetSlots.map(([targetSlot, options]) => (
                      <label key={targetSlot} className="flex flex-col gap-1 text-sm">
                        <span className="text-muted-foreground">{targetSlot}</span>
                        <select
                          aria-label={definition.name + " " + targetSlot + " target"}
                          className="h-9 rounded-md border border-border bg-background px-2 text-foreground"
                          disabled={isTurnLocked || updateActionSubmission.isPending}
                          value={targets[targetSlot] ?? ""}
                          onChange={(event) => {
                            const targetId = event.target.value
                            setTargetSelections((currentSelections) => ({
                              ...currentSelections,
                              [action.id]: {
                                ...currentSelections[action.id],
                                [targetSlot]: targetId,
                              },
                            }))
                          }}
                        >
                          <option value="">Select a target</option>
                          {options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isTurnLocked || updateActionSubmission.isPending || (!isSelected && !action.canAfford) || !hasAllTargets}
                    onClick={selectAction}
                  >
                    {isSelected ? "Update action" : "Select action"}
                  </Button>
                  {isSelected ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isTurnLocked || updateActionSubmission.isPending}
                      onClick={deselectAction}
                    >
                      Deselect
                    </Button>
                  ) : null}
                </div>
              </div>
            )
            return (
              <ActionCard
                key={action.id}
                actionDefinition={definition}
                resources={playerView.resources}
                canAfford={action.canAfford}
                isSelected={isSelected}
                disabled={isTurnLocked || updateActionSubmission.isPending || (!action.canAfford && !isSelected)}
                controls={controls}
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
