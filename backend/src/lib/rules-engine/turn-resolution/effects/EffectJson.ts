import type { Effect } from "#lib/rules-engine/turn-resolution/effects/Effect.ts"

/**
 * Only meant for error reporting, nothing more.
 */
export type EffectJson = {
  id: Effect["id"]
  type: Effect["type"]
}
