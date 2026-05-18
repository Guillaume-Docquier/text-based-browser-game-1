import type { StarSystemGenerationSettings } from "#lib/db/star-systems/starSystems.repository.ts"
import { createStarSystemGenerationSettingsDtoStub } from "#api/games/StarSystemGenerationSettingsDto.stub.ts"

export function createStarSystemGenerationSettingsStub(overrides?: Partial<StarSystemGenerationSettings>): StarSystemGenerationSettings {
  return {
    ...createStarSystemGenerationSettingsDtoStub(overrides),
    seed: overrides?.seed ?? 1234,
  }
}
