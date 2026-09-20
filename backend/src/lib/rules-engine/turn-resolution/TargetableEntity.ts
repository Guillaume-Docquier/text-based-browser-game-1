import type { FleetId } from "#lib/db/fleets/FleetId.ts"
import type { PlanetId } from "#lib/db/planets/PlanetId.ts"
import type { PlayerId } from "#lib/db/players/PlayerId.ts"
import type { TargetType } from "#lib/rules-engine/ruleset-model/mechanics/TargetType.ts"
import type { Fleet, Player, Planet } from "#lib/rules-engine/turn-resolution/TurnState.ts"

type TargetId<TTargetType extends TargetType> = {
  [TargetType.FLEET]: FleetId
  [TargetType.PLANET]: PlanetId
  [TargetType.PLAYER]: PlayerId
}[TTargetType]
type Target<TTargetType extends TargetType, TTargetModel extends { id: TargetId<TTargetType> }> = { type: TTargetType } & TTargetModel

// we might want an entity manager to effectively query entities?
// these are the data, entities might be richer?
export type TargetableEntity =
  | Target<typeof TargetType.FLEET, Fleet>
  | Target<typeof TargetType.PLAYER, Player>
  | Target<typeof TargetType.PLANET, Planet>
