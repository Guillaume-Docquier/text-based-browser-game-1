import type { FleetTargetConstraint } from "#shared/domain/ruleset/target-definitions/fleet/FleetTargetConstraint.ts"
import type { PlanetTargetConstraint } from "#shared/domain/ruleset/target-definitions/planet/PlanetTargetConstraint.ts"
import type { PlayerTargetConstraint } from "#shared/domain/ruleset/target-definitions/player/PlayerTargetConstraint.ts"
import type { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"

/**
 * Each entity owns an independent set of target constraints.
 */
export type TargetConstraint = {
  readonly [TargetType.FLEET]: FleetTargetConstraint
  readonly [TargetType.PLANET]: PlanetTargetConstraint
  readonly [TargetType.PLAYER]: PlayerTargetConstraint
}
