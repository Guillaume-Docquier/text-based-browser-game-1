import type { Fleet } from "#shared/domain/world/fleets/Fleet.ts"
import type { Planet } from "#shared/domain/world/planets/Planet.ts"
import type { ResolutionPlayer } from "#shared/turn-resolution/state/ResolutionPlayer.ts"

/**
 * Existing domain entities supported by the experimental engine.
 */
export type TargetEntities = { fleet: Fleet; planet: Planet; player: ResolutionPlayer }
export type TargetKind = keyof TargetEntities
export type TargetSlots = Readonly<Record<string, TargetKind>>
/**
 * A symbolic reference carries its entity kind while a ruleset is compiled.
 */
export type TargetRef<K extends TargetKind = TargetKind> = Readonly<{ name: string; kind: K }>
export type TargetRefs<T extends TargetSlots> = { readonly [S in keyof T]: TargetRef<T[S]> }
export type ResolvedTargets<T extends TargetSlots> = { readonly [S in keyof T]: TargetEntities[T[S]] }
export type CompatibleNames<T extends TargetSlots, K extends TargetKind> = {
  [N in keyof T]: T[N] extends K ? N : never
}[keyof T]
export type Bindings<T extends TargetSlots, M extends TargetSlots> = {
  readonly [S in keyof M]: CompatibleNames<T, M[S]>
}
