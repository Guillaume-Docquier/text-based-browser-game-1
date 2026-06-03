import type { StarSystemGenerationSettings } from "#lib/db/star-systems/starSystemGenerationSettings.repository.ts"
import { createDefaultStarSystemGenerationSettings } from "#lib/star-systems/defaultStarSystemGenerationSettings.ts"

export function createStarSystemGenerationSettingsStub(overrides?: Partial<StarSystemGenerationSettings>): StarSystemGenerationSettings {
  return {
    ...createDefaultStarSystemGenerationSettings(),
    ...overrides,
  }
}
