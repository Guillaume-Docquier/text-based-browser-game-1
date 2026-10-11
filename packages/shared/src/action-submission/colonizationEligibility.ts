import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { ColonizeEffectDefinition } from "#shared/domain/ruleset/effect-definitions/ColonizeEffectDefinition.ts"

/** One owner predicate for declarative targets and final colonization. */
export function isUnclaimedPlanet(ownerPlayerId: PlayerId | null): boolean {
  return ownerPlayerId === null
}
/** Initial selection and post-Combat validation share the configured requirement. */
export function evaluateColonization({
  definition,
  ownerPlayerId,
  strength,
}: {
  definition: ColonizeEffectDefinition
  ownerPlayerId: PlayerId | null
  strength: number
}): string[] {
  const reasons: string[] = []
  if (!isUnclaimedPlanet(ownerPlayerId)) reasons.push("Planet is already claimed")
  if (strength < definition.parameters.requiredStrength)
    reasons.push(`Colonization requires at least ${definition.parameters.requiredStrength} Strength`)
  return reasons
}
