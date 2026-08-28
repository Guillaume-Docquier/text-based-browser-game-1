import type { Resources } from "#lib/rules-engine/ruleset-model/mechanics/Resources.ts"
import { ResourceType } from "#lib/rules-engine/ruleset-model/mechanics/ResourceType.ts"

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
