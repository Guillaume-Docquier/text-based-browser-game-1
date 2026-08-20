import { v4 } from "uuid"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { ResourceUpdateModel } from "#tests/resources/resources.repository.ts"

export function createResourceUpdateModelStub(override: Partial<ResourceUpdateModel> = {}): ResourceUpdateModel {
  return {
    gameId: 999,
    playerId: v4(),
    resourceType: ResourceType.INFLUENCE,
    amountDelta: 1,
    ...override,
  }
}
