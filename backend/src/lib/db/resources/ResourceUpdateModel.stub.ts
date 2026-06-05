import { ResourceType } from "#lib/gameResources.ts"
import type { ResourceUpdateModel } from "#lib/db/resources/gamePlayerResources.repository.ts"

export function createResourceUpdateModelStub(override: Partial<ResourceUpdateModel> = {}): ResourceUpdateModel {
  return {
    gameId: 1,
    playerId: 1,
    resourceType: ResourceType.MONEY,
    amountDelta: 1,
    ...override,
  }
}
