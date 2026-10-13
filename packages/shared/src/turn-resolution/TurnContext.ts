import type { Rng } from "@guillaume-docquier/tools-ts"
import type { Ruleset } from "#shared/domain/ruleset/Ruleset.ts"
import type { FleetId } from "#shared/domain/world/fleets/FleetId.ts"
import type { ArrivalIntent } from "#shared/turn-resolution/ArrivalIntent.ts"
import type { EffectPool } from "#shared/turn-resolution/effects/EffectPool.ts"
import type { TurnState } from "#shared/turn-resolution/TurnState.ts"

export type TurnContext = Readonly<{
  /**
   * Rng when you need it.
   * Will be seeded and persisted so runs are fully deterministic.
   */
  arrivalIntents: ArrivalIntent[]
  destroyedFleetIds: Set<FleetId>
  rng: Rng
  /**
   * The turn state, to mutate.
   */
  turnState: TurnState
  /**
   * All the Effects that need resolving, to mutate.
   */
  effectPool: EffectPool
  /**
   * The rules for this turn.
   */
  ruleset: Ruleset
}>
