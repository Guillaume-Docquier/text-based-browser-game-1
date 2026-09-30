import type { LobbyPlayers, PlayerView, TargetDefinition, TargetId } from "@api-types"
import type { Comparator } from "@guillaume-docquier/tools-ts"
import type { TargetForValidation } from "game-rules/action-submission/validation/targets/target-constraints/TargetConstraintEvaluator.ts"
import { validateTarget } from "game-rules/action-submission/validation/targets/validateTarget.ts"
import { TargetType } from "game-rules/ruleset/effect-definitions/TargetType.ts"
import type { ReactElement } from "react"
import { SearchSelect } from "@/components/search-select.tsx"
import { formatRulesetTerm } from "@/features/play/effectDefinitionToRulesText.ts"

/**
 * A player-visible choice for an Action target slot.
 */
export type TargetOption = { id: TargetId; label: string }
type TargetCandidate = TargetOption & { target: TargetForValidation }

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
  onChange,
}: {
  targetTag: string
  targetDefinition: TargetDefinition
  options: readonly TargetOption[]
  value: TargetId | undefined
  disabled: boolean
  onChange: (targetId: TargetId) => void
}): ReactElement {
  const label = formatRulesetTerm(targetTag)
  const onlyOption = options.length === 1 ? options[0] : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">{label} target</span>
      <SearchSelect
        label={`${label} target`}
        options={options}
        value={onlyOption?.id ?? value}
        disabled={disabled}
        placeholder={
          options.length === 0 ? `No ${targetDefinition.targetType.toLowerCase()} targets available` : `Choose ${label.toLowerCase()}`
        }
        onValueChange={onChange}
      />
    </div>
  )
}

/**
 * Resolves target choices from the player-visible game state and the slot constraints.
 */
export function getTargetOptions(targetDefinition: TargetDefinition, playerView: PlayerView, players: LobbyPlayers): TargetOption[] {
  return getTargetCandidates(targetDefinition, playerView, players)
    .filter(
      (candidate) => validateTarget({ target: candidate.target, submittingPlayerId: playerView.player.id, targetDefinition }) === null,
    )
    .sort(sortByLabel)
}

function getTargetCandidates(targetDefinition: TargetDefinition, playerView: PlayerView, players: LobbyPlayers): TargetCandidate[] {
  switch (targetDefinition.targetType) {
    case TargetType.PLANET:
      return playerView.galaxy.systems.flatMap(({ planets }) =>
        planets.map((planet) => ({
          id: planet.id,
          label: `${planet.name} (${planet.coordinates})`,
          target: { type: TargetType.PLANET, ownerPlayerId: planet.ownerPlayerId },
        })),
      )
    case TargetType.PLAYER:
      return players.map((player) => ({
        id: player.id,
        label: player.alias,
        target: { type: TargetType.PLAYER },
      }))
    case TargetType.FLEET:
      return playerView.fleets.map((fleet) => ({
        id: fleet.id,
        label: `Fleet ${fleet.id.slice(0, 8)} (${fleet.strength} strength)`,
        target: { type: TargetType.FLEET, ownerPlayerId: fleet.ownerPlayerId },
      }))
  }
}
