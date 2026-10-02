import type { PlayerId } from "#shared/domain/players/PlayerId.ts"
import type { Resources } from "#shared/domain/resources/Resources.ts"

export type ResolutionPlayer = {
  readonly id: PlayerId
  readonly resources: Resources
}
