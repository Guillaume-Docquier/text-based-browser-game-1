import type { PlayerId } from "#shared/domain/players/PlayerId.ts"

/**
 * Returns whether a Planet has no owner, using the shared exactly-null ownership rule.
 */
export function isPlanetUnclaimed(ownerPlayerId: PlayerId | null): boolean {
  return ownerPlayerId === null
}
