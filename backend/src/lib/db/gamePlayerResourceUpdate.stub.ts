import { ResourceType, type ResourceType as ResourceTypeT } from "#lib/gameResources.ts"

export type GamePlayerResourceUpdate = {
  gameId: number
  playerId: number
  resourceType: ResourceTypeT
  amountDelta: number
}

export function createGamePlayerResourceUpdateStub(override: Partial<GamePlayerResourceUpdate> = {}): GamePlayerResourceUpdate {
  return {
    gameId: 1,
    playerId: 1,
    resourceType: ResourceType.MONEY,
    amountDelta: 1,
    ...override,
  }
}
