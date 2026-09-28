import type { PlayerId } from "#game-rules/models/PlayerId.ts"
import type { Resources } from "#game-rules/ruleset/effect-definitions/Resources.ts"

export type Player = {
  readonly id: PlayerId
  readonly resources: Resources
}
