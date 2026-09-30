import type { TargetType } from "#game-rules/ruleset/effect-definitions/TargetType.ts"
import type { Fleet } from "#game-rules/turn-resolution/Fleet.ts"
import type { Planet } from "#game-rules/turn-resolution/Planet.ts"
import type { Player } from "#game-rules/turn-resolution/Player.ts"

// we might want an entity manager to effectively query entities?
// these are the data, entities might be richer?
export type TargetableEntity = TargetableFleet | TargetablePlayer | TargetablePlanet

export type TargetableFleet = { type: typeof TargetType.FLEET } & Fleet
export type TargetablePlayer = { type: typeof TargetType.PLAYER } & Player
export type TargetablePlanet = { type: typeof TargetType.PLANET } & Planet
