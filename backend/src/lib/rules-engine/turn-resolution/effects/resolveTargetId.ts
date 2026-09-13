import { Assert, branded } from "@guillaume-docquier/tools-ts"
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
 * A utility to resolve target ids from selected targets and a target definition.
 * It will parse and brand the target id for you.
 * Returns null if the target is not found.
 */
export function safeResolveTargetId<TTargetType extends TargetType>(
  selectedTargets: SelectedTargets,
  targetDefinition: TargetDefinition<TTargetType>,
): TargetId<TTargetType> | null
export function safeResolveTargetId(
  selectedTargets: SelectedTargets,
  targetDefinition: TargetDefinition,
): PlanetId | FleetId | PlayerId | null {
  const targetId = selectedTargets[targetDefinition.tag]
  if (targetId === undefined) {
    // we return null instead of undefined to keep the below switch case exhaustive. Missing a branch will have TS error out because the function doesn't return a value.
    return null
  }

  switch (targetDefinition.type) {
    case TargetType.FLEET:
      return branded<FleetId>(targetId)
    case TargetType.PLANET:
      return branded<PlanetId>(Number(targetId))
    case TargetType.PLANET_OWNED:
      return branded<PlanetId>(Number(targetId))
    case TargetType.PLAYER:
      return branded<PlayerId>(targetId)
  }
}

/**
 * A utility to resolve target ids from selected targets and a target definition.
 * It will parse and brand the target id for you.
 * It is expected that targets have been validated by {@link validateTargets} prior to calling this. Any invalid target will throw an Assertion error.
 */
export function resolveTargetId<TTargetType extends TargetType>(
  selectedTargets: SelectedTargets,
  targetDefinition: TargetDefinition<TTargetType>,
): TargetId<TTargetType>
export function resolveTargetId(selectedTargets: SelectedTargets, targetDefinition: TargetDefinition): PlanetId | FleetId | PlayerId {
  const targetId = safeResolveTargetId(selectedTargets, targetDefinition)
  // Assert is not allowed in rules-engine, but this one is okay because it is a program invariant. Targets must have been validated already and the lookup must be valid.
  // A failure here means the validation code is flawed
  Assert.isDefined(targetId)
  return targetId
}
