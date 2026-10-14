import type { Action, ActionDefinition, PlayerView, Players } from "@api-types"
import { useState, type ComponentProps, type ReactElement } from "react"
import { requireEligibilityProjection } from "./ActionCard.selection-fixture.tsx"
import { ActionCard } from "./ActionCard.tsx"

/** Keeps the card's submitted selection observable through its rendered state. */
export function StatefulActionCard(props: ComponentProps<typeof ActionCard>): ReactElement {
  const [action, setAction] = useState(props.action)
  return (
    <div className="w-80">
      <ActionCard
        {...props}
        action={action}
        onSelect={(selectedTargets, selectedInputs) => {
          setAction({ ...action, selectedTargets, selectedInputs })
        }}
      />
    </div>
  )
}
/** Reprojects selected inputs through the public selector before displaying the next interaction. */
export function ProjectedActionCard({
  initialAction,
  playerView,
  definition,
  players,
  outputLabel,
}: {
  initialAction: Action
  playerView: PlayerView
  definition: ActionDefinition
  players: Players
  outputLabel: string
}): ReactElement {
  const [action, setAction] = useState(initialAction)
  const currentPlayerView = { ...playerView, actions: [action] }
  const projection = requireEligibilityProjection(currentPlayerView)
  return (
    <div className="w-80">
      <output data-testid={outputLabel} className="sr-only">
        {JSON.stringify({ selectedTargets: action.selectedTargets, selectedInputs: action.selectedInputs })}
      </output>
      <ActionCard
        actionDefinition={definition}
        action={action}
        playerView={currentPlayerView}
        players={players}
        ruleset={projection.ruleset}
        eligibilityState={projection.eligibilityState}
        disabled={false}
        onSelect={(selectedTargets, selectedInputs) => {
          setAction({ ...action, selectedTargets, selectedInputs })
        }}
      />
    </div>
  )
}
