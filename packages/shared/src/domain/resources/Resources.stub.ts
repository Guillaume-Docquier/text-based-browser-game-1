import type { Resources } from "#shared/domain/resources/Resources.ts"
import { ResourceType } from "#shared/domain/resources/ResourceType.ts"

/**
 * By default, all resources are 0. You can rely on this in your tests to make assertions lighter.
 */
export function createResourcesStub(overrides?: Partial<Resources>): Resources {
  return {
    [ResourceType.INFLUENCE]: 0,
    [ResourceType.METAL]: 0,
    [ResourceType.FUEL]: 0,
    [ResourceType.ENERGY]: 0,
    [ResourceType.COLONY]: 0,
    ...overrides,
  }
}
