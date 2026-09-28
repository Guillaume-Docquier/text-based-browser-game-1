import type { FleetId } from "#game-rules/models/FleetId.ts"
import type { PlanetId } from "#game-rules/models/PlanetId.ts"
import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import type { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import type { Fleet, Player, Planet } from "#game-rules/turn-resolution/TurnState.ts"

type TargetId<TTargetType extends TargetType> = {
  [TargetType.FLEET]: FleetId
  [TargetType.PLANET]: PlanetId
  [TargetType.PLAYER]: PlayerId
}[TTargetType]
type Target<TTargetType extends TargetType, TTargetModel extends { id: TargetId<TTargetType> }> = { type: TTargetType } & TTargetModel

// we might want an entity manager to effectively query entities?
// these are the data, entities might be richer?
export type TargetableEntity = TargetableFleet | TargetablePlayer | TargetablePlanet

export type TargetableFleet = Target<typeof TargetType.FLEET, Fleet>
export type TargetablePlayer = Target<typeof TargetType.PLAYER, Player>
export type TargetablePlanet = Target<typeof TargetType.PLANET, Planet>
