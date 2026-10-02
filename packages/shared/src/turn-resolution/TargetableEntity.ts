import type { TargetType } from "#shared/domain/ruleset/target-definitions/TargetType.ts"
import type { ResolutionFleet } from "#shared/turn-resolution/state/ResolutionFleet.ts"
import type { ResolutionPlanet } from "#shared/turn-resolution/state/ResolutionPlanet.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"

// we might want an entity manager to effectively query entities?
// these are the data, entities might be richer?
export type TargetableEntity = TargetableFleet | TargetablePlayer | TargetablePlanet

export type TargetableFleet = { type: typeof TargetType.FLEET } & ResolutionFleet
export type TargetablePlayer = { type: typeof TargetType.PLAYER } & ResolutionPlayer
export type TargetablePlanet = { type: typeof TargetType.PLANET } & ResolutionPlanet
