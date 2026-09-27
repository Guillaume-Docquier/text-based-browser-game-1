import type { Action, ActionDefinition, Lobby, LobbyPlayer, Planet, PlayerId, PlayerView } from "@api-types"
import { Assert } from "@guillaume-docquier/tools-ts"
import type { ReactElement } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/select.tsx"
import { formatRulesetTerm } from "@/features/play/effectDefinitionToRulesText.ts"

type SelectedTargets = NonNullable<Action["selectedTargets"]>
type TargetId = SelectedTargets[keyof SelectedTargets]
type TargetDefinition = ActionDefinition["targets"][keyof ActionDefinition["targets"]]
type TargetConstraint = TargetDefinition["constraints"][number]
type TargetOption = { id: TargetId; label: string }
type TargetCandidate = TargetOption &
  (
    | { targetType: "PLANET"; ownerPlayerId: Planet["ownerPlayerId"] }
    | { targetType: "FLEET"; playerId: PlayerId }
    | { targetType: "PLAYER" }
  )

// The fleet list is optional until it is added to the backend player view.
type TargetPickerPlayerView = PlayerView & { fleets?: ReadonlyArray<{ id: TargetId; playerId: PlayerId; strength: number }> }

const TARGET_CONSTRAINT_MATCHERS = {
  OWNED_BY_SUBMITTING_PLAYER: (candidate: TargetCandidate, currentPlayerId: PlayerId): boolean => {
    switch (candidate.targetType) {
      case "PLANET":
        return candidate.ownerPlayerId === currentPlayerId
      case "FLEET":
        return candidate.playerId === currentPlayerId
      case "PLAYER":
        return false
    }
  },
} satisfies Record<TargetConstraint["type"], (candidate: TargetCandidate, currentPlayerId: PlayerId) => boolean>

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
  playerView: TargetPickerPlayerView
  players: LobbyPlayer[]
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
export function getTargetOptions(
  targetDefinition: TargetDefinition,
  playerView: TargetPickerPlayerView,
  players: LobbyPlayer[],
): TargetOption[] {
  // Keep this local constraint check until target resolution is shared with the backend.
  return getTargetCandidates(targetDefinition, playerView, players).filter((candidate) =>
    matchesConstraints(candidate, targetDefinition.constraints, playerView.player.id),
  )
}

function getTargetCandidates(
  targetDefinition: TargetDefinition,
  playerView: TargetPickerPlayerView,
  players: Lobby["players"],
): TargetCandidate[] {
  switch (targetDefinition.targetType) {
    case "PLANET":
      return playerView.galaxy.systems.flatMap(({ planets }) =>
        planets.map((planet) => ({
          targetType: "PLANET" as const,
          id: planet.id,
          label: `${planet.name} (${planet.coordinates})`,
          ownerPlayerId: planet.ownerPlayerId,
        })),
      )
    case "PLAYER":
      return players.map((player) => ({ targetType: "PLAYER", id: player.id, label: player.alias }))
    case "FLEET":
      return (playerView.fleets ?? []).map((fleet) => ({
        targetType: "FLEET",
        id: fleet.id,
        label: `Fleet ${fleet.id.slice(0, 8)} (${fleet.strength} strength)`,
        playerId: fleet.playerId,
      }))
  }
}

function matchesConstraints(candidate: TargetCandidate, constraints: TargetDefinition["constraints"], currentPlayerId: PlayerId): boolean {
  return constraints.every((constraint) => TARGET_CONSTRAINT_MATCHERS[constraint.type](candidate, currentPlayerId))
}
