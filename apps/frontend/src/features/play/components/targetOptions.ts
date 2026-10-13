import type { Action, Players, PlayerView, TargetDefinition, TargetId, TargetTag } from "@api-types"
import type { Comparator } from "@guillaume-docquier/tools-ts"
import {
  evaluateTargetSelection,
  type ActionEligibilityState,
  type ActionSelectionDraft,
} from "shared/action-submission/actionEligibility.ts"
import { TargetType } from "shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * A player-visible choice for an Action target slot.
 */
export type TargetOption = { id: TargetId; label: string }

const TEXT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const sortByLabel: Comparator<{ label: string }> = (first, second) => TEXT_COLLATOR.compare(first.label, second.label)

/**
 * Resolves target choices from the player-visible game state and the slot constraints.
 */
export type TargetOptionsRequest = Readonly<{
  targetDefinition: TargetDefinition
  playerView: PlayerView
  players: Players
  action: Action
  targetTag: TargetTag
  selection: ActionSelectionDraft
  state: ActionEligibilityState
}>

export function getTargetOptions({
  targetDefinition,
  playerView,
  players,
  action,
  targetTag,
  selection,
  state,
}: TargetOptionsRequest): TargetOption[] {
  return getTargetCandidates(targetDefinition, playerView, players)
    .filter(
      (candidate) =>
        evaluateTargetSelection({
          state,
          ruleset: playerView.ruleset,
          action: { ...action, playerId: playerView.player.id },
          selection,
          targetTag,
          targetId: candidate.id,
        }).status === "eligible",
    )
    .sort(sortByLabel)
}

function getTargetCandidates(targetDefinition: TargetDefinition, playerView: PlayerView, players: Players): TargetOption[] {
  switch (targetDefinition.targetType) {
    case TargetType.PLANET:
      return playerView.galaxy.systems.flatMap(({ planets }) =>
        planets.map((planet) => ({
          id: planet.id,
          label: `${planet.name} (${planet.coordinates})`,
        })),
      )
    case TargetType.PLAYER:
      return players.map((player) => ({
        id: player.id,
        label: player.alias,
      }))
    case TargetType.FLEET:
      return playerView.fleets.map((fleet) => ({
        id: fleet.id,
        label: `Fleet ${fleet.id.slice(0, 8)} (${fleet.strength} strength)`,
      }))
  }
}
