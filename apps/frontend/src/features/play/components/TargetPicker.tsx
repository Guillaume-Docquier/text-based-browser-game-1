import type { LobbyPlayers, PlayerView, TargetDefinition, TargetId } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import { validateTarget } from "game-rules/action-submission/validation/targets/validateTarget.ts"
import type { TargetForValidation } from "game-rules/action-submission/validation/validators/target-constraints/TargetConstraintEvaluator.ts"
import { TargetType } from "game-rules/ruleset/effect-definitions/TargetType.ts"
import type { ReactElement } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select.tsx"
import { formatRulesetTerm } from "@/features/play/effectDefinitionToRulesText.ts"

type TargetOption = { id: TargetId; label: string }
type TargetCandidate = TargetOption & { target: TargetForValidation }

/**
 * Selects an entity for one Action Definition target slot.
 */
export function TargetPicker({
  targetTag,
  targetDefinition,
  playerView,
  players,
  value,
  disabled,
  onChange,
}: {
  targetTag: string
  targetDefinition: TargetDefinition
  playerView: PlayerView
  players: LobbyPlayers
  value: TargetId | undefined
  disabled: boolean
  onChange: (targetId: TargetId) => void
}): ReactElement {
  const label = formatRulesetTerm(targetTag)
  const options = getTargetOptions(targetDefinition, playerView, players)
  const onlyOption = options.length === 1 ? options[0] : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">{label} target</span>
      <Select
        value={onlyOption?.id ?? value}
        disabled={disabled || options.length <= 1}
        onValueChange={(id) => {
          const option = options.find((candidate) => candidate.id === id)
          Assert.isDefined(option)
          onChange(option.id)
        }}
      >
        <SelectTrigger aria-label={`${label} target`} className="w-full min-w-0">
          <SelectValue
            placeholder={
              options.length === 0 ? `No ${targetDefinition.targetType.toLowerCase()} targets available` : `Choose ${label.toLowerCase()}`
            }
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Resolves target choices from the player-visible game state and the slot constraints.
 */
export function getTargetOptions(targetDefinition: TargetDefinition, playerView: PlayerView, players: LobbyPlayers): TargetOption[] {
  return getTargetCandidates(targetDefinition, playerView, players).filter(
    (candidate) => validateTarget({ target: candidate.target, submittingPlayerId: playerView.player.id, targetDefinition }) === null,
  )
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
