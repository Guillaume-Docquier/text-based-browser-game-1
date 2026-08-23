import type { ResourcesDto } from "#api/gameplay/ResourcesDto.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

export function createResourcesDtoStub(overrides?: Partial<ResourcesDto>): ResourcesDto {
  return {
    [ResourceType.INFLUENCE]: { total: 0, uncommitted: 0 },
    [ResourceType.METAL]: { total: 0, uncommitted: 0 },
    [ResourceType.FUEL]: { total: 0, uncommitted: 0 },
    [ResourceType.ENERGY]: { total: 0, uncommitted: 0 },
    [ResourceType.COLONY]: { total: 0, uncommitted: 0 },
    ...overrides,
  }
}
