import type { Players, PlayerView, TargetDefinition, TargetId, TargetTag } from "@api-types"
import type { Comparator } from "@guillaume-docquier/tools-ts"
import type { ReactElement } from "react"
import {
  evaluateTargetCandidate,
  type ActionSelectionDraft,
  type EligibilityState,
} from "shared/action-submission/evaluateActionSelection.ts"
import type { Ruleset } from "shared/domain/ruleset/Ruleset.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"
import { SearchSelect } from "@/components/search-select.tsx"
import { formatRulesetTerm } from "@/features/play/effectDefinitionToRulesText.ts"

/**
 * A player-visible candidate for an Action target slot.
 */
export type TargetOption = { id: TargetId; label: string }

const TEXT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const sortByLabel: Comparator<{ label: string }> = (first, second) => TEXT_COLLATOR.compare(first.label, second.label)

/**
 * Selects an entity for one Action Definition target slot.
 */
export function TargetPicker({
  targetTag,
  targetDefinition,
  options,
  value,
  disabled,
  issue,
  onChange,
}: {
  targetTag: TargetTag
  targetDefinition: TargetDefinition
  options: readonly TargetOption[]
  value: TargetId | undefined
  disabled: boolean
  issue: string | undefined
  onChange: (targetId: TargetId) => void
}): ReactElement {
  const label = formatRulesetTerm(targetTag)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">{label} target</span>
      <SearchSelect
        label={`${label} target`}
        options={options}
        value={value}
        disabled={disabled}
        placeholder={
          options.length === 0 ? `No ${targetDefinition.targetType.toLowerCase()} targets available` : `Choose ${label.toLowerCase()}`
        }
        onValueChange={onChange}
      />
      {issue === undefined ? null : (
        <p role="alert" className="text-xs text-destructive">
          {issue}
        </p>
      )}
    </div>
  )
}

/**
 * Lists target candidates that the shared evaluator considers selectable for this draft.
 */
export function getTargetOptions({
  targetTag,
  targetDefinition,
  playerView,
  players,
  state,
  ruleset,
  draft,
}: {
  targetTag: TargetTag
  targetDefinition: TargetDefinition
  playerView: PlayerView
  players: Players
  state: EligibilityState
  ruleset: Ruleset
  draft: ActionSelectionDraft
}): TargetOption[] {
  return getTargetCandidates(targetDefinition, playerView, players)
    .filter(({ id }) => evaluateTargetCandidate({ state, ruleset, draft, targetTag, targetId: id }).candidateStatus === "ELIGIBLE")
    .sort(sortByLabel)
}

function getTargetCandidates(targetDefinition: TargetDefinition, playerView: PlayerView, players: Players): TargetOption[] {
  switch (targetDefinition.targetType) {
    case TargetType.PLANET:
      return playerView.galaxy.systems.flatMap(({ planets }) =>
        planets.map((planet) => ({ id: planet.id, label: `${planet.name} (${planet.coordinates})` })),
      )
    case TargetType.PLAYER:
      return players.map((player) => ({ id: player.id, label: player.alias ?? `Player ${player.id}` }))
    case TargetType.FLEET:
      return playerView.fleets.map((fleet) => ({ id: fleet.id, label: `${fleet.name} (${fleet.strength} strength)` }))
    default:
      return []
  }
}
