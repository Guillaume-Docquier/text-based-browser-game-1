import { branded, type UnbrandedProperties } from "@guillaume-docquier/tools-ts"
import { v4 } from "uuid"
import { type GameId } from "#lib/db/games/GameId.ts"
import { type PlayerId } from "#lib/db/players/PlayerId.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"
import type { ResourceUpdateModel } from "#tests/resources/resources.repository.ts"

export function createResourceUpdateModelStub({
  gameId = 999,
  playerId = v4(),
  ...overrides
}: Partial<UnbrandedProperties<ResourceUpdateModel>> = {}): ResourceUpdateModel {
  return {
    gameId: branded<GameId>(gameId),
    playerId: branded<PlayerId>(playerId),
    resourceType: ResourceType.INFLUENCE,
    amountDelta: 1,
    ...overrides,
  }
}
