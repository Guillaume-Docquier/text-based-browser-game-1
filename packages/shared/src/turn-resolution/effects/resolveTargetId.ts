import { Assert, branded } from "@guillaume-docquier/tools-ts"
import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { EffectDefinitionTargetDefinition } from "#shared/domain/ruleset/effect-definitions/EffectDefinitionTargetDefinition.ts"
import { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import type { SelectedTargets } from "#shared/domain/turns/actions/SelectedTargets.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { PlanetId } from "#shared/domain/world/planets/PlanetId.ts"

type TargetId<TTargetType extends TargetType> = {
  [TargetType.FLEET]: FleetId
  [TargetType.PLANET]: PlanetId
  [TargetType.PLAYER]: PlayerId
}[TTargetType]

/**
 * A utility to resolve target ids from selected targets and a target definition.
 * It will parse and brand the target id for you.
 * Returns null if the target is not found.
 */
export function safeResolveTargetId<TTargetType extends TargetType>(
  selectedTargets: SelectedTargets,
  targetDefinition: EffectDefinitionTargetDefinition<TTargetType>,
): TargetId<TTargetType> | null
export function safeResolveTargetId(
  selectedTargets: SelectedTargets,
  targetDefinition: EffectDefinitionTargetDefinition,
): TargetId<TargetType> | null {
  const targetId = selectedTargets[targetDefinition.actionTargetTag]
  if (targetId === undefined) {
    // we return null instead of undefined to keep the below switch case exhaustive. Missing a branch will have TS error out because the function doesn't return a value.
    return null
  }

  switch (targetDefinition.targetType) {
    case TargetType.FLEET:
      return branded<FleetId>(targetId)
    case TargetType.PLANET:
      return branded<PlanetId>(targetId)
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
  targetDefinition: EffectDefinitionTargetDefinition<TTargetType>,
): TargetId<TTargetType>
export function resolveTargetId(
  selectedTargets: SelectedTargets,
  targetDefinition: EffectDefinitionTargetDefinition,
): PlanetId | FleetId | PlayerId {
  const targetId = safeResolveTargetId(selectedTargets, targetDefinition)
  // Assert is not allowed in rules-engine, but this one is okay because it is a program invariant. Targets must have been validated already and the lookup must be valid.
  // A failure here means the validation code is flawed
  Assert.isDefined(targetId)
  return targetId
}
