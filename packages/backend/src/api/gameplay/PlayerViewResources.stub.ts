import { ResourceType } from "shared/domain/resources/ResourceType.ts"
import type { PlayerViewResources } from "#api/gameplay/PlayerViewResources.ts"

export function createPlayerViewResourcesStub(overrides?: Partial<PlayerViewResources>): PlayerViewResources {
  return {
    [ResourceType.INFLUENCE]: { total: 0, uncommitted: 0 },
    [ResourceType.METAL]: { total: 0, uncommitted: 0 },
    [ResourceType.FUEL]: { total: 0, uncommitted: 0 },
    [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
    [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
    ...overrides,
  }
}
