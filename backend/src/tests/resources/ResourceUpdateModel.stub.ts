import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { ResourceUpdateModel } from "#tests/resources/resources.repository.ts"

export function createResourceUpdateModelStub({
  gameId = 999,
  playerId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<ResourceUpdateModel>> = {}): ResourceUpdateModel {
  return {
    gameId: branded(gameId),
    playerId: branded(playerId),
    resourceType: ResourceType.INFLUENCE,
    amountDelta: 1,
    ...overrides,
  }
}
