import { Assert, branded, NotImplementedError } from "@guillaume-docquier/tools-ts"
import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { SelectedTargets } from "#lib/rules-engine/ruleset-model/actions/SelectedTargets.ts"
import type { TargetDefinition } from "#lib/rules-engine/ruleset-model/mechanics/TargetDefinition.ts"
import { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"

type TargetId<TTargetType extends TargetType> = {
  [TargetType.FLEET]: FleetId
  [TargetType.PLANET]: PlanetId
  [TargetType.PLANET_OWNED]: PlanetId
  [TargetType.PLAYER]: PlayerId
}[TTargetType]

/**
 * A utility to resolve target ids.
 * It is expected that targets have been validated prior to calling this, we will just parse and brand for you.
 */
export function resolveTargetId<TTargetType extends TargetType>(
  selectedTargets: SelectedTargets,
  targetDefinition: TargetDefinition<TTargetType>,
): TargetId<TTargetType>
export function resolveTargetId(selectedTargets: SelectedTargets, targetDefinition: TargetDefinition): PlanetId | FleetId | PlayerId {
  const targetId = selectedTargets[targetDefinition.tag]
  // Assert is not allowed in rules-engine, but this one is okay because it is a program invariant. Targets must have been validated already and the lookup must be valid.
  // A failure here means the validation code is flawed
  Assert.isDefined(targetId)

  switch (targetDefinition.type) {
    case TargetType.FLEET:
      return branded<FleetId>(targetId)
    case TargetType.PLANET:
      return branded<PlanetId>(Number(targetId))
    case TargetType.PLANET_OWNED:
      throw new NotImplementedError({ trackedBy: "https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/422" })
    case TargetType.PLAYER:
      return branded<PlayerId>(targetId)
  }
}
